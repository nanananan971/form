import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { CamposFormulario } from './CamposFormulario';
import { SelectorHorarios } from './SelectorHorarios';
import { MensajeAlerta } from './MensajeAlerta';

export function FormularioProfesional() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [profesional, setProfesional] = useState(null);
  const [horariosDisponibles, setHorariosDisponibles] = useState([]);
  const [slotSeleccionado, setSlotSeleccionado] = useState('');
  
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [servicioSeleccionado, setServicioSeleccionado] = useState('');
  const [modalidadSeleccionada, setModalidadSeleccionada] = useState('');
  const [comunaSeleccionada, setComunaSeleccionada] = useState('');
  const [direccionCliente, setDireccionCliente] = useState('');
  
  const [pasoPago, setPasoPago] = useState(false); 
  const [pagoIniciado, setPagoIniciado] = useState(false); 
  const [reservaExitosa, setReservaExitosa] = useState(false);
  const [mensajeAlerta, setMensajeAlerta] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function cargarDatosProfesional() {
      setLoading(true);
      const { data: profData, error: profError } = await supabase
        .rpc('get_public_professional', { p_form_id: slug.toLowerCase() });

      if (profError || !profData || profData.length === 0) {
        setProfesional(null);
        setLoading(false);
        return;
      }

      const prof = profData[0];
      setProfesional(prof);

      const mods = prof.modalidades || { presencial: true, domicilio: false };
      if (mods.presencial) setModalidadSeleccionada('presencial');
      else if (mods.domicilio) setModalidadSeleccionada('domicilio');

      const servs = Array.isArray(prof.servicios) ? prof.servicios : [];
      if (servs.length > 0) setServicioSeleccionado(servs[0].nombre);

      const { data: slotInfo, error: slotError } = await supabase
        .rpc('get_public_availability', { p_professional_id: prof.id });

      if (!slotError && slotInfo) {
        const availabilityData = slotInfo.availability || [];
        const apptsData = slotInfo.appointments || [];
        const slotsGenerados = [];
        const ahora = new Date();
        const tiempoMinimoPermitido = new Date(ahora.getTime() + 60 * 60 * 1000);
        const DIAS_A_MOSTRAR = 30;

        for (let i = 0; i < DIAS_A_MOSTRAR; i++) {
          const fechaObj = new Date();
          fechaObj.setDate(ahora.getDate() + i);
          const dayOfWeek = fechaObj.getDay();
          const yearStr = fechaObj.getFullYear();
          const monthStr = String(fechaObj.getMonth() + 1).padStart(2, '0');
          const dayStr = String(fechaObj.getDate()).padStart(2, '0');
          const fechaFormatoSql = `${yearStr}-${monthStr}-${dayStr}`;

          const matchingAvailabilities = availabilityData.filter(a => {
            if (a.day_of_week !== dayOfWeek) return false;
            if (a.is_permanent_schedule) return true;
            if (a.valid_from && fechaFormatoSql < a.valid_from) return false;
            if (a.valid_until && fechaFormatoSql > a.valid_until) return false;
            return true;
          });

          matchingAvailabilities.forEach(rule => {
            const [sh, sm] = rule.start_time.split(':').map(Number);
            const [eh, em] = rule.end_time.split(':').map(Number);
            const slotDuration = rule.slot_duration_minutes || 30;
            const intervalMinutes = rule.interval_minutes || 0;
            const totalStep = slotDuration + intervalMinutes;

            let currentMinutes = sh * 60 + sm;
            const endMinutes = eh * 60 + em;

            while (currentMinutes + slotDuration <= endMinutes) {
              const h = Math.floor(currentMinutes / 60).toString().padStart(2, '0');
              const m = (currentMinutes % 60).toString().padStart(2, '0');
              const timeStr = `${h}:${m}:00`;
              const timeShort = `${h}:${m}`;
              const slotDateTimeStr = `${fechaFormatoSql}T${timeShort}`;
              const slotDateObj = new Date(slotDateTimeStr);
              const esMuyPronto = slotDateObj < tiempoMinimoPermitido;

              const estaOcupadoEnDb = apptsData.some(app => {
                if (!app.start_time) return false;
                const appDateObj = new Date(app.start_time);
                return `${appDateObj.getFullYear()}-${String(appDateObj.getMonth() + 1).padStart(2, '0')}-${String(appDateObj.getDate()).padStart(2, '0')}T${String(appDateObj.getHours()).padStart(2, '0')}:${String(appDateObj.getMinutes()).padStart(2, '0')}` === slotDateTimeStr;
              });

              slotsGenerados.push({
                slot_date: fechaFormatoSql,
                start_time: timeStr,
                is_booked: esMuyPronto || estaOcupadoEnDb
              });

              currentMinutes += totalStep;
            }
          });
        }
        setHorariosDisponibles(slotsGenerados);
      }
      setLoading(false);
    }

    if (slug) cargarDatosProfesional();
  }, [slug]);

  const handleContinuar = async (e) => {
    e.preventDefault();
    if (!slotSeleccionado) {
      setMensajeAlerta('Por favor selecciona un horario disponible.');
      return;
    }
    if (!nombre.trim() || !email.trim() || !telefono.trim()) {
      setMensajeAlerta('Por favor completa todos tus datos de contacto.');
      return;
    }
    if (!servicioSeleccionado) {
      setMensajeAlerta('Por favor selecciona un servicio.');
      return;
    }
    if (modalidadSeleccionada === 'domicilio') {
      const comunasCobertura = Array.isArray(profesional.comunas_cobertura) ? profesional.comunas_cobertura : [];
      if (comunasCobertura.length > 0 && !comunaSeleccionada) {
        setMensajeAlerta('Por favor selecciona la comuna para tu atención a domicilio.');
        return;
      }
      if (!direccionCliente.trim()) {
        setMensajeAlerta('Por favor ingresa tu dirección exacta para la atención a domicilio.');
        return;
      }
    }

    setMensajeAlerta('');
    if (profesional.requiere_abono && profesional.mp_payment_link) {
      setPasoPago(true);
      setPagoIniciado(false); 
    } else {
      const exito = await ejecutarReserva();
      if (exito) setReservaExitosa(true);
    }
  };

  const ejecutarReserva = async () => {
    setSubmitting(true);
    setMensajeAlerta('');
    try {
      const [slotDate, startTime] = slotSeleccionado.split('|');
      const startDateTimeIso = `${slotDate}T${startTime}`;
      const startDateObj = new Date(startDateTimeIso);
      const endDateObj = new Date(startDateObj.getTime() + 30 * 60000);

      const { error: rpcError } = await supabase.rpc('crear_reserva_publica', {
        p_professional_id: profesional.id,
        p_nombre: nombre.trim(),
        p_email: email.trim(),
        p_telefono: telefono.trim(),
        p_start_time: startDateObj.toISOString(),
        p_end_time: endDateObj.toISOString(),
        p_modalidad: modalidadSeleccionada,
        p_comuna: modalidadSeleccionada === 'domicilio' ? comunaSeleccionada : null,
        p_direccion: modalidadSeleccionada === 'domicilio' ? direccionCliente.trim() : null,
        p_servicio: servicioSeleccionado
      });

      if (rpcError) throw rpcError;
      setSubmitting(false);
      return true;
    } catch (error) {
      console.error('Error al agendar:', error);
      setMensajeAlerta('Hubo un error al registrar la cita. Inténtalo de nuevo.');
      setSubmitting(false);
      return false;
    }
  };

  const handlePagarMercadoPago = () => {
    setPagoIniciado(true); 
    window.open(profesional.mp_payment_link, '_blank');
  };

  const handleAvisarWhatsApp = async () => {
    setSubmitting(true);
    const exito = await ejecutarReserva();
    if (!exito) return;

    setReservaExitosa(true);
    const [slotDate, startTime] = slotSeleccionado.split('|');
    const [h, m] = startTime.split(':');
    const horaLegible = `${h}:${m}`;
    const telefonoRaw = profesional.phone || '56949819428';
    const telefonoClinica = String(telefonoRaw).replace(/\D/g, ''); 
    
    const textoMensaje = encodeURIComponent(
      `Hola ${profesional.full_name || 'Clínica'}, acabo de realizar la reserva para mi cita de ${servicioSeleccionado} (${modalidadSeleccionada}${modalidadSeleccionada === 'domicilio' ? ` en ${comunaSeleccionada}, ${direccionCliente}` : ''}) agendada el día ${slotDate} a las ${horaLegible}. Mi nombre es ${nombre}.`
    );

    window.open(`https://wa.me/${telefonoClinica}?text=${textoMensaje}`, '_blank');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc', color: '#64748b', fontFamily: 'system-ui, sans-serif', padding: '16px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #0284c7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}></div>
          <p style={{ fontSize: '15px', fontWeight: '500' }}>Cargando agenda profesional...</p>
        </div>
      </div>
    );
  }

  if (!profesional) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc', padding: '16px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '40px 24px', background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', maxWidth: '400px', width: '100%' }}>
          <h3 style={{ color: '#0f172a', marginBottom: '8px', fontSize: '20px', fontWeight: '700' }}>Profesional no encontrado</h3>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5' }}>Verifica el enlace proporcionado e inténtalo nuevamente.</p>
        </div>
      </div>
    );
  }

  const serviciosList = Array.isArray(profesional.servicios) ? profesional.servicios : [];
  const modalidades = profesional.modalidades || { presencial: true, domicilio: false };
  const comunasCobertura = Array.isArray(profesional.comunas_cobertura) ? profesional.comunas_cobertura : [];
  const instruccionesList = Array.isArray(profesional.mensaje_bienvenida) ? profesional.mensaje_bienvenida : [];

  const [, startTime] = slotSeleccionado ? slotSeleccionado.split('|') : ['', ''];
  const horaLegible = startTime ? startTime.slice(0, 5) : '';
  const [slotDate] = slotSeleccionado ? slotSeleccionado.split('|') : ['', ''];

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: '32px 16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxSizing: 'border-box'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '760px', 
        background: '#ffffff', 
        borderRadius: '32px', 
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.12), 0 4px 6px -4px rgba(15, 23, 42, 0.04)',
        overflow: 'hidden',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        boxSizing: 'border-box'
      }}>
        {/* Cabecera Premium Estilo SaaS */}
        <div style={{ 
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', 
          padding: '40px 24px', 
          color: '#ffffff',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          boxSizing: 'border-box',
          position: 'relative'
        }}>
          <div style={{
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            border: '4px solid rgba(255, 255, 255, 0.9)',
            overflow: 'hidden',
            background: '#ffffff',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            padding: '4px',
            boxSizing: 'border-box'
          }}>
            {profesional.avatar_url ? (
              <img src={profesional.avatar_url} alt="Perfil profesional" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
            ) : (
              <span style={{ fontSize: '34px', fontWeight: 'bold', color: '#0284c7' }}>
                {(profesional.full_name || 'P')[0]?.toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <span style={{ 
              display: 'inline-block', 
              background: 'rgba(255, 255, 255, 0.2)', 
              backdropFilter: 'blur(4px)',
              padding: '6px 16px', 
              borderRadius: '20px', 
              fontSize: '11px', 
              fontWeight: '800', 
              letterSpacing: '1px',
              marginBottom: '10px',
              textTransform: 'uppercase'
            }}>
              {profesional.clinic_name || 'Centro Podológico'}
            </span>
            <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 6px', letterSpacing: '-0.025em', wordBreak: 'break-word' }}>
              {reservaExitosa ? '¡Cita Reservada con Éxito!' : pasoPago ? 'Confirmación de Abono' : 'Reserva tu Cita Profesional'}
            </h1>
            <p style={{ fontSize: '14px', opacity: 0.9, margin: 0, fontWeight: '400', wordBreak: 'break-word' }}>
              Atención especializada con <strong style={{ fontWeight: '600' }}>{profesional.full_name || slug}</strong>
            </p>
          </div>
        </div>

        {/* Contenido principal */}
        <div style={{ padding: '36px 32px', boxSizing: 'border-box' }}>
          <MensajeAlerta mensaje={mensajeAlerta} />
          
          {reservaExitosa ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'center' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '20px', padding: '28px 20px' }}>
                <div style={{ width: '56px', height: '56px', background: '#22c55e', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', margin: '0 auto 14px', boxShadow: '0 8px 20px rgba(34, 197, 94, 0.35)' }}>
                  ✓
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: '20px', color: '#166534', fontWeight: '800' }}>
                  ¡Reserva Registrada Exitosamente!
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#15803d' }}>
                  Hemos registrado tus datos correctamente. Aquí tienes el resumen de tu atención:
                </p>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                  📋 Detalle de la Cita
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px' }}>
                  <div style={{ flex: '1 1 180px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '3px' }}>PACIENTE</span>
                    <strong style={{ color: '#1e293b', fontSize: '14px', wordBreak: 'break-word' }}>{nombre}</strong>
                  </div>
                  <div style={{ flex: '1 1 180px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '3px' }}>TELÉFONO</span>
                    <strong style={{ color: '#1e293b', fontSize: '14px', wordBreak: 'break-word' }}>{telefono}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px' }}>
                  <div style={{ flex: '1 1 180px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '3px' }}>FECHA Y HORA</span>
                    <strong style={{ color: '#0284c7', fontSize: '14px', wordBreak: 'break-word' }}>{slotDate} a las {horaLegible} hrs.</strong>
                  </div>
                  <div style={{ flex: '1 1 180px' }}>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '3px' }}>SERVICIO</span>
                    <strong style={{ color: '#1e293b', fontSize: '14px', wordBreak: 'break-word' }}>{servicioSeleccionado}</strong>
                  </div>
                </div>

                <div style={{ fontSize: '13px' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '3px' }}>MODALIDAD Y UBICACIÓN</span>
                  <strong style={{ color: '#1e293b', fontSize: '14px', wordBreak: 'break-word' }}>
                    {modalidadSeleccionada === 'presencial' ? (
                      `🏥 Presencial — ${profesional.direccion_consulta || 'En consulta'}`
                    ) : (
                      `🏠 A Domicilio — Comuna: ${comunaSeleccionada} (${direccionCliente})`
                    )}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '16px',
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: '750',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '15px',
                  boxShadow: '0 8px 20px rgba(2, 132, 199, 0.3)',
                  boxSizing: 'border-box'
                }}
              >
                Volver al inicio
              </button>
            </div>
          ) : !pasoPago ? (
            <form onSubmit={handleContinuar} style={{ display: 'flex', flexDirection: 'column', gap: '26px', boxSizing: 'border-box' }}>
              
              {/* Sección Servicios con estilo tarjeta */}
              {serviciosList.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '750', color: '#1e293b' }}>
                    ✨ Selecciona el servicio podológico:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    {serviciosList.map((s, idx) => {
                      const isSelected = servicioSeleccionado === s.nombre;
                      return (
                        <div
                          key={idx}
                          onClick={() => setServicioSeleccionado(s.nombre)}
                          style={{
                            padding: '16px',
                            borderRadius: '16px',
                            border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                            background: isSelected ? '#f0f9ff' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: isSelected ? '0 4px 12px rgba(2, 132, 199, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}
                        >
                          <span style={{ fontSize: '14px', fontWeight: '750', color: isSelected ? '#0369a1' : '#1e293b' }}>
                            {s.nombre}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#0284c7' }}>
                            ${Number(s.precio || 0).toLocaleString('es-CL')} CLP
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sección Modalidad de Atención */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '14px', fontWeight: '750', color: '#1e293b' }}>
                  🏥 Modalidad de atención:
                </label>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {modalidades.presencial && (
                    <div
                      onClick={() => setModalidadSeleccionada('presencial')}
                      style={{
                        flex: '1 1 140px',
                        padding: '16px',
                        borderRadius: '16px',
                        border: modalidadSeleccionada === 'presencial' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                        background: modalidadSeleccionada === 'presencial' ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontWeight: '700',
                        fontSize: '14px',
                        color: modalidadSeleccionada === 'presencial' ? '#0369a1' : '#334155',
                        boxShadow: modalidadSeleccionada === 'presencial' ? '0 4px 12px rgba(2, 132, 199, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s'
                      }}
                    >
                      🏥 Presencial
                    </div>
                  )}
                  {modalidades.domicilio && (
                    <div
                      onClick={() => setModalidadSeleccionada('domicilio')}
                      style={{
                        flex: '1 1 140px',
                        padding: '16px',
                        borderRadius: '16px',
                        border: modalidadSeleccionada === 'domicilio' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                        background: modalidadSeleccionada === 'domicilio' ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontWeight: '700',
                        fontSize: '14px',
                        color: modalidadSeleccionada === 'domicilio' ? '#0369a1' : '#334155',
                        boxShadow: modalidadSeleccionada === 'domicilio' ? '0 4px 12px rgba(2, 132, 199, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s'
                      }}
                    >
                      🏠 A Domicilio
                    </div>
                  )}
                </div>
              </div>

              {/* Mapa si es presencial */}
              {modalidadSeleccionada === 'presencial' && profesional.direccion_consulta && (
                <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
                  <p style={{ fontSize: '13px', color: '#1e293b', margin: 0, fontWeight: '750', wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📍</span> Dirección de consulta: {profesional.direccion_consulta}
                  </p>
                  <div style={{ width: '100%', height: '160px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                    <iframe
                      title="Mapa de ubicación"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      style={{ border: 0 }}
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(profesional.direccion_consulta)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>
              )}

              {/* Datos domicilio */}
              {modalidadSeleccionada === 'domicilio' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#f8fafc', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
                  {comunasCobertura.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '750', color: '#1e293b' }}>Selecciona tu comuna:</label>
                      <select
                        value={comunaSeleccionada}
                        onChange={(e) => setComunaSeleccionada(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          borderRadius: '12px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#0f172a',
                          fontSize: '14px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="">-- Elige tu comuna --</option>
                        {comunasCobertura.map((comuna, idx) => (
                          <option key={idx} value={comuna}>{comuna}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '750', color: '#1e293b' }}>Dirección exacta (Calle, número, depto):</label>
                    <input
                      type="text"
                      value={direccionCliente}
                      onChange={(e) => setDireccionCliente(e.target.value)}
                      placeholder="Ej. Av. Vicuña Mackenna 4320"
                      required
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Datos del Paciente */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#1e293b' }}>
                  👤 Tus datos de contacto
                </p>
                <CamposFormulario 
                  label="Nombre completo" 
                  type="text" 
                  value={nombre} 
                  onChange={(e) => setNombre(e.target.value)} 
                  placeholder="Ej. María González" 
                />
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', boxSizing: 'border-box' }}>
                  <div style={{ flex: '1 1 220px', boxSizing: 'border-box' }}>
                    <CamposFormulario 
                      label="Correo electrónico" 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="correo@ejemplo.com" 
                    />
                  </div>
                  <div style={{ flex: '1 1 220px', boxSizing: 'border-box' }}>
                    <CamposFormulario 
                      label="Teléfono" 
                      type="tel" 
                      value={telefono} 
                      onChange={(e) => setTelefono(e.target.value)} 
                      placeholder="+569..." 
                    />
                  </div>
                </div>
              </div>

              {/* Selector de Horarios */}
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                <SelectorHorarios 
                  slotSeleccionado={slotSeleccionado} 
                  onChange={setSlotSeleccionado} 
                  horariosDisponibles={horariosDisponibles} 
                />
              </div>

              {/* Recomendaciones */}
              {instruccionesList.length > 0 && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '18px', padding: '18px 22px', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '18px' }}>💡</span>
                    <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0369a1', margin: 0 }}>
                      Indicaciones importantes para tu cita
                    </h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {instruccionesList.map((inst, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#334155' }}>
                        <span style={{ color: '#0284c7', fontWeight: 'bold' }}>•</span>
                        <span style={{ lineHeight: '1.4', wordBreak: 'break-word' }}>{inst}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón de envío principal */}
              <button 
                type="submit" 
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '18px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#fff',
                  fontWeight: '800',
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  fontSize: '16px',
                  marginTop: '8px',
                  boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.4)',
                  boxSizing: 'border-box',
                  transition: 'transform 0.1s ease'
                }}
              >
                {submitting ? 'Procesando...' : profesional.requiere_abono && profesional.mp_payment_link ? 'Continuar al pago de abono ➔' : 'Confirmar mi Cita'}
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Tarjeta Destacada de Monto */}
              <div style={{ 
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', 
                border: '2px solid #bae6fd', 
                borderRadius: '20px', 
                padding: '24px 20px', 
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.08)'
              }}>
                <span style={{ 
                  fontSize: '12px', 
                  fontWeight: '800', 
                  color: '#0369a1', 
                  textTransform: 'uppercase', 
                  letterSpacing: '1px',
                  display: 'inline-block',
                  marginBottom: '6px'
                }}>
                  🔒 Abono Requerido para Confirmación
                </span>
                <div style={{ fontSize: '36px', fontWeight: '900', color: '#0284c7', letterSpacing: '-0.03em', margin: '4px 0' }}>
                  ${Number(profesional.monto_abono || 0).toLocaleString('es-CL')} CLP
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#334155', fontWeight: '500' }}>
                  Este monto se descuenta del total del valor del servicio.
                </p>
              </div>

              {/* Pasos a seguir */}
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                borderRadius: '20px', 
                padding: '22px 20px', 
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📌</span> Pasos simples para agendar:
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  
                  {/* Paso 1 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '50%', 
                      background: '#0284c7', 
                      color: '#ffffff', 
                      fontWeight: '800', 
                      fontSize: '13px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      1
                    </div>
                    <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600', lineHeight: '1.4', paddingTop: '3px' }}>
                      Haz clic en <strong style={{ color: '#009ee3', fontWeight: '800' }}>Pagar Abono en Mercado Pago</strong> (se abrirá en una nueva ventana).
                    </div>
                  </div>

                  {/* Paso 2 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '50%', 
                      background: '#0284c7', 
                      color: '#ffffff', 
                      fontWeight: '800', 
                      fontSize: '13px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      2
                    </div>
                    <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600', lineHeight: '1.4', paddingTop: '3px' }}>
                      Realiza tu pago seguro mediante débito, crédito o transferencia.
                    </div>
                  </div>

                  {/* Paso 3 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '50%', 
                      background: '#0284c7', 
                      color: '#ffffff', 
                      fontWeight: '800', 
                      fontSize: '13px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      3
                    </div>
                    <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600', lineHeight: '1.4', paddingTop: '3px' }}>
                      Regresa a esta ventana y presiona <strong style={{ color: '#16a34a', fontWeight: '800' }}>Enviar comprobante por WhatsApp</strong> para finalizar.
                    </div>
                  </div>

                </div>
              </div>

              {/* Botón Principal de Mercado Pago */}
              <button
                type="button"
                onClick={handlePagarMercadoPago}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '18px 24px',
                  borderRadius: '16px',
                  background: '#009ee3',
                  color: '#ffffff',
                  fontWeight: '800',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  boxShadow: '0 10px 25px -5px rgba(0, 158, 227, 0.4)',
                  boxSizing: 'border-box',
                  transition: 'transform 0.1s ease'
                }}
              >
                <span style={{ fontSize: '20px' }}>💳</span> 
                <span>Pagar Abono en Mercado Pago</span>
              </button>

              {/* Acción posterior al inicio del pago */}
              {pagoIniciado && (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '14px', 
                  background: '#f0fdf4',
                  border: '2px solid #86efac', 
                  padding: '20px', 
                  borderRadius: '20px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '14px', color: '#14532d', fontWeight: '800', margin: '0 0 4px' }}>
                      ¿Ya realizaste tu pago en Mercado Pago?
                    </p>
                    <p style={{ fontSize: '12px', color: '#166534', margin: 0 }}>
                      Presiona el botón de abajo para notificar y confirmar tu hora en la agenda.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAvisarWhatsApp}
                    disabled={submitting}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      padding: '16px',
                      borderRadius: '14px',
                      background: '#22c55e',
                      color: '#ffffff',
                      fontWeight: '800',
                      border: 'none',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.7 : 1,
                      fontSize: '15px',
                      boxShadow: '0 8px 20px rgba(34, 197, 94, 0.35)',
                      boxSizing: 'border-box'
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>💬</span> 
                    <span>{submitting ? 'Registrando cita...' : 'Ya pagué, enviar comprobante por WhatsApp'}</span>
                  </button>
                </div>
              )}

              {/* Volver */}
              <button 
                type="button" 
                onClick={() => setPasoPago(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontWeight: '700',
                  alignSelf: 'center',
                  padding: '6px'
                }}
              >
                ← Volver a la selección de horarios
              </button>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}