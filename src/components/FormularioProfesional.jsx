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
  
  // Datos del paciente y selección de formulario
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [servicioSeleccionado, setServicioSeleccionado] = useState('');
  const [modalidadSeleccionada, setModalidadSeleccionada] = useState('');
  const [comunaSeleccionada, setComunaSeleccionada] = useState('');
  const [direccionCliente, setDireccionCliente] = useState('');
  
  // Estados de flujo y confirmación
  const [pasoPago, setPasoPago] = useState(false); 
  const [pagoIniciado, setPagoIniciado] = useState(false); 
  const [reservaExitosa, setReservaExitosa] = useState(false); // NUEVO: Muestra el modal de confirmación final
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
      if (servs.length > 0) {
        setServicioSeleccionado(servs[0].nombre);
      }

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
                const appYear = appDateObj.getFullYear();
                const appMonth = String(appDateObj.getMonth() + 1).padStart(2, '0');
                const appDay = String(appDateObj.getDate()).padStart(2, '0');
                const appHour = String(appDateObj.getHours()).padStart(2, '0');
                const appMin = String(appDateObj.getMinutes()).padStart(2, '0');
                
                const appFormatted = `${appYear}-${appMonth}-${appDay}T${appHour}:${appMin}`;
                return appFormatted === slotDateTimeStr;
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
      if (exito) {
        setReservaExitosa(true); // Despliega la ventana de confirmación directamente
      }
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
        p_direccion: modalidadSeleccionada === 'domicilio' ? direccionCliente.trim() : null
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

    setReservaExitosa(true); // Mostrar modal de confirmación en la web

    const [slotDate, startTime] = slotSeleccionado.split('|');
    const [h, m] = startTime.split(':');
    const horaLegible = `${h}:${m}`;

    const telefonoRaw = profesional.phone || '56949819428';
    const telefonoClinica = String(telefonoRaw).replace(/\D/g, ''); 
    
    const textoMensaje = encodeURIComponent(
      `Hola ${profesional.full_name || 'Clínica'}, acabo de realizar la reserva para mi cita de ${servicioSeleccionado} (${modalidadSeleccionada}${modalidadSeleccionada === 'domicilio' ? ` en ${comunaSeleccionada},${direccionCliente}` : ''}) agendada el día ${slotDate} a las ${horaLegible}. Mi nombre es ${nombre}.`
    );

    window.open(`https://wa.me/${telefonoClinica}?text=${textoMensaje}`, '_blank');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc', color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
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
        <div style={{ textAlign: 'center', padding: '40px 32px', background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', maxWidth: '400px', width: '100%' }}>
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

  const [slotDate, startTime] = slotSeleccionado ? slotSeleccionado.split('|') : ['', ''];
  const horaLegible = startTime ? startTime.slice(0, 5) : '';

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f0fdf4 0%, #f1f5f9 100%)', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: '24px 16px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '620px', 
        background: '#ffffff', 
        borderRadius: '24px', 
        boxShadow: '0 20px 35px -10px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.03)',
        overflow: 'hidden',
        border: '1px solid rgba(226, 232, 240, 0.8)'
      }}>
        {/* Cabecera */}
        <div style={{ 
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', 
          padding: '32px 24px', 
          color: '#ffffff',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            border: '3px solid rgba(255, 255, 255, 0.8)',
            overflow: 'hidden',
            background: '#ffffff',
            boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {profesional.avatar_url ? (
              <img src={profesional.avatar_url} alt="Perfil profesional" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#0284c7' }}>
                {(profesional.full_name || 'P')[0]?.toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <span style={{ 
              display: 'inline-block', 
              background: 'rgba(255, 255, 255, 0.15)', 
              padding: '3px 12px', 
              borderRadius: '20px', 
              fontSize: '11px', 
              fontWeight: '600', 
              letterSpacing: '0.5px',
              marginBottom: '6px',
              textTransform: 'uppercase'
            }}>
              {profesional.clinic_name || 'Centro Podológico'}
            </span>
            <h2 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 4px', letterSpacing: '-0.025em' }}>
              {reservaExitosa ? '¡Cita Reservada con Éxito!' : pasoPago ? 'Confirmación de Abono' : 'Reserva tu Cita'}
            </h2>
            <p style={{ fontSize: '14px', opacity: 0.9, margin: 0, fontWeight: '400' }}>
              Atención con <strong style={{ fontWeight: '600' }}>{profesional.full_name || slug}</strong>
            </p>
          </div>
        </div>

        {/* Contenido */}
        <div style={{ padding: '32px 28px' }}>
          <MensajeAlerta mensaje={mensajeAlerta} />
          
          {reservaExitosa ? (
            /* VISTA DE CONFIRMACIÓN FINAL (COMPROBANTE) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '16px', padding: '24px 20px' }}>
                <div style={{ width: '50px', height: '50px', background: '#22c55e', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 12px' }}>
                  ✓
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: '18px', color: '#166534', fontWeight: '700' }}>
                  ¡Reserva Registrada Exitosamente!
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#15803d' }}>
                  Hemos registrado tus datos. A continuación tienes el resumen de tu atención:
                </p>
              </div>

              {/* Tarjeta de Resumen */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                  📋 Detalle de la Cita
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px', fontWeight: '600' }}>PACIENTE</span>
                    <strong style={{ color: '#334155' }}>{nombre}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px', fontWeight: '600' }}>TELÉFONO</span>
                    <strong style={{ color: '#334155' }}>{telefono}</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px', fontWeight: '600' }}>FECHA Y HORA</span>
                    <strong style={{ color: '#0284c7' }}>{slotDate} a las {horaLegible} hrs.</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px', fontWeight: '600' }}>SERVICIO</span>
                    <strong style={{ color: '#334155' }}>{servicioSeleccionado}</strong>
                  </div>
                </div>

                <div style={{ fontSize: '13px' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px', fontWeight: '600' }}>MODALIDAD Y UBICACIÓN</span>
                  <strong style={{ color: '#334155' }}>
                    {modalidadSeleccionada === 'presencial' ? (
                      `🏥 Presencial — ${profesional.direccion_consulta || 'En consulta'}`
                    ) : (
                      `🏠 A Domicilio — Comuna: ${comunaSeleccionada} (${direccionCliente})`
                    )}
                  </strong>
                </div>

                <div style={{ fontSize: '13px' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px', fontWeight: '600' }}>CENTRO / PROFESIONAL</span>
                  <strong style={{ color: '#334155' }}>{profesional.clinic_name} ({profesional.full_name})</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Volver al inicio
              </button>
            </div>
          ) : !pasoPago ? (
            <form onSubmit={handleContinuar} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {serviciosList.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Selecciona el servicio:</label>
                  <select
                    value={servicioSeleccionado}
                    onChange={(e) => setServicioSeleccionado(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    {serviciosList.map((s, idx) => (
                      <option key={idx} value={s.nombre}>
                        {s.nombre} — ${Number(s.precio || 0).toLocaleString('es-CL')} CLP
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Modalidad de atención:</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {modalidades.presencial && (
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', border: modalidadSeleccionada === 'presencial' ? '2px solid #0284c7' : '1px solid #cbd5e1', background: modalidadSeleccionada === 'presencial' ? '#f0f9ff' : '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                      <input 
                        type="radio" 
                        name="modalidad" 
                        checked={modalidadSeleccionada === 'presencial'} 
                        onChange={() => setModalidadSeleccionada('presencial')} 
                      />
                      🏥 Presencial
                    </label>
                  )}
                  {modalidades.domicilio && (
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', border: modalidadSeleccionada === 'domicilio' ? '2px solid #0284c7' : '1px solid #cbd5e1', background: modalidadSeleccionada === 'domicilio' ? '#f0f9ff' : '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                      <input 
                        type="radio" 
                        name="modalidad" 
                        checked={modalidadSeleccionada === 'domicilio'} 
                        onChange={() => setModalidadSeleccionada('domicilio')} 
                      />
                      🏠 A Domicilio
                    </label>
                  )}
                </div>
              </div>

              {modalidadSeleccionada === 'presencial' && profesional.direccion_consulta && (
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontSize: '13px', color: '#334155', margin: 0, fontWeight: '600' }}>
                    📍 Dirección: {profesional.direccion_consulta}
                  </p>
                  <div style={{ width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
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

              {modalidadSeleccionada === 'domicilio' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  {comunasCobertura.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Selecciona tu comuna:</label>
                      <select
                        value={comunaSeleccionada}
                        onChange={(e) => setComunaSeleccionada(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#0f172a',
                          fontSize: '14px',
                          outline: 'none'
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
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Dirección exacta (Calle, número, depto):</label>
                    <input
                      type="text"
                      value={direccionCliente}
                      onChange={(e) => setDireccionCliente(e.target.value)}
                      placeholder="Ej. Av. Vicuña Mackenna 4320, Depto 42"
                      required
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
                <CamposFormulario 
                  label="Nombre completo" 
                  type="text" 
                  value={nombre} 
                  onChange={(e) => setNombre(e.target.value)} 
                  placeholder="Ej. María González" 
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <CamposFormulario 
                    label="Correo electrónico" 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="correo@ejemplo.com" 
                  />
                  <CamposFormulario 
                    label="Teléfono" 
                    type="tel" 
                    value={telefono} 
                    onChange={(e) => setTelefono(e.target.value)} 
                    placeholder="+569..." 
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <SelectorHorarios 
                  slotSeleccionado={slotSeleccionado} 
                  onChange={setSlotSeleccionado} 
                  horariosDisponibles={horariosDisponibles} 
                />
              </div>

              {instruccionesList.length > 0 && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '14px' }}>
                  <p style={{ fontSize: '13px', fontWeight: '650', color: '#0369a1', margin: '0 0 6px' }}>
                    💡 Recomendaciones importantes:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                    {instruccionesList.map((inst, idx) => (
                      <li key={idx}>{inst}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button 
                type="submit" 
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '15px',
                  borderRadius: '14px',
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: '600',
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  fontSize: '15px',
                  marginTop: '4px',
                  boxShadow: '0 10px 15px -3px rgba(2, 132, 199, 0.25)',
                  transition: 'all 0.2s ease'
                }}
              >
                {submitting ? 'Procesando...' : profesional.requiere_abono && profesional.mp_payment_link ? 'Continuar al pago de abono ➔' : 'Confirmar Reserva'}
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px 20px' }}>
                <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 6px', fontWeight: '500' }}>
                  Para confirmar tu reserva se requiere un abono de:
                </p>
                <p style={{ fontSize: '28px', fontWeight: '800', color: '#0284c7', margin: '0 0 14px', letterSpacing: '-0.02em' }}>
                  ${Number(profesional.monto_abono || 0).toLocaleString('es-CL')} CLP
                </p>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', textAlign: 'left' }}>
                  <p style={{ fontSize: '13px', color: '#334155', margin: '0 0 8px', fontWeight: '600' }}>Instrucciones:</p>
                  <ol style={{ fontSize: '13px', color: '#64748b', margin: 0, paddingLeft: '18px', lineHeight: '1.5' }}>
                    <li>Haz clic en el botón de abajo para pagar tu abono en Mercado Pago.</li>
                    <li>Cuando termines el pago, regresa a esta misma pantalla.</li>
                    <li>Se habilitará automáticamente el botón para notificar tu pago por WhatsApp.</li>
                  </ol>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePagarMercadoPago}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '15px',
                  borderRadius: '14px',
                  background: '#009ee3',
                  color: '#fff',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '15px',
                  boxShadow: '0 10px 15px -3px rgba(0, 158, 227, 0.25)'
                }}
              >
                <span>💳</span> Pagar Abono en Mercado Pago
              </button>

              {pagoIniciado && (
                <div style={{ animation: 'fadeIn 0.3s ease-in-out', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '16px' }}>
                  <p style={{ fontSize: '13px', color: '#166534', fontWeight: '600', background: '#f0fdf4', padding: '10px', borderRadius: '8px', border: '1px solid #bbf7d0', margin: 0 }}>
                    ¿Ya realizaste el pago en la otra pestaña?
                  </p>
                  <button
                    type="button"
                    onClick={handleAvisarWhatsApp}
                    disabled={submitting}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '15px',
                      borderRadius: '14px',
                      background: '#22c55e',
                      color: '#fff',
                      fontWeight: '700',
                      border: 'none',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.7 : 1,
                      fontSize: '15px',
                      boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.25)'
                    }}
                  >
                    <span>💬</span> {submitting ? 'Registrando cita...' : 'Ya pagué, enviar comprobante por WhatsApp'}
                  </button>
                </div>
              )}

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
                  fontWeight: '500',
                  marginTop: '4px'
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