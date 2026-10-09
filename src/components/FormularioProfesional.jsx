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
  
  const [pasoPago, setPasoPago] = useState(false); 
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

      const { data: slotInfo, error: slotError } = await supabase
        .rpc('get_public_availability', { p_professional_id: prof.id });

      if (!slotError && slotInfo) {
        const availabilityData = slotInfo.availability || [];
        const apptsData = slotInfo.appointments || [];

        const slotsGenerados = [];
        const ahora = new Date();
        const tiempoMinimoPermitido = new Date(ahora.getTime() + 3 * 60 * 60 * 1000);

        const año = ahora.getFullYear();
        const mes = ahora.getMonth();
        const diasEnMes = new Date(año, mes + 1, 0).getDate();

        for (let dia = ahora.getDate(); dia <= diasEnMes; dia++) {
          const fechaObj = new Date(año, mes, dia);
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

  const handleContinuar = (e) => {
    e.preventDefault();
    if (!slotSeleccionado) {
      setMensajeAlerta('Por favor selecciona un horario disponible.');
      return;
    }
    if (!nombre.trim() || !email.trim() || !telefono.trim()) {
      setMensajeAlerta('Por favor completa todos tus datos de contacto.');
      return;
    }

    setMensajeAlerta('');

    if (profesional.requiere_abono && profesional.mp_payment_link) {
      setPasoPago(true);
    } else {
      ejecutarReserva();
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
        p_end_time: endDateObj.toISOString()
      });

      if (rpcError) throw rpcError;

      return true;
    } catch (error) {
      console.error('Error al agendar:', error);
      setMensajeAlerta('Hubo un error al registrar la cita. Inténtalo de nuevo.');
      setSubmitting(false);
      return false;
    }
  };

  const handleAvisarWhatsApp = async () => {
    setSubmitting(true);
    const exito = await ejecutarReserva();
    
    if (!exito) return;

    const [slotDate, startTime] = slotSeleccionado.split('|');
    const [h, m] = startTime.split(':');
    const horaLegible = `${h}:${m}`;

    const telefonoClinica = profesional.phone || '56900000000'; 
    
    const textoMensaje = encodeURIComponent(
      `Hola ${profesional.full_name || 'Clínica'}, acabo de realizar el pago del abono de $${Number(profesional.monto_abono || 0).toLocaleString('es-CL')} para mi cita agendada el día ${slotDate} a las ${horaLegible}. Mi nombre es ${nombre}. Adjunto mi comprobante.`
    );

    window.location.href = `https://wa.me/${telefonoClinica}?text=${textoMensaje}`;
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
        maxWidth: '580px', 
        background: '#ffffff', 
        borderRadius: '24px', 
        boxShadow: '0 20px 35px -10px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.03)',
        overflow: 'hidden',
        border: '1px solid rgba(226, 232, 240, 0.8)'
      }}>
        {/* Cabecera estilizada */}
        <div style={{ 
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', 
          padding: '32px 24px', 
          color: '#ffffff',
          textAlign: 'center' 
        }}>
          <span style={{ 
            display: 'inline-block', 
            background: 'rgba(255, 255, 255, 0.15)', 
            padding: '4px 12px', 
            borderRadius: '20px', 
            fontSize: '12px', 
            fontWeight: '600', 
            letterSpacing: '0.5px',
            marginBottom: '10px',
            textTransform: 'uppercase'
          }}>
            {profesional.clinic_name || 'Centro Podológico'}
          </span>
          <h2 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 6px', letterSpacing: '-0.025em' }}>
            {pasoPago ? 'Confirmación de Abono' : 'Reserva tu Cita'}
          </h2>
          <p style={{ fontSize: '14px', opacity: 0.9, margin: 0, fontWeight: '400' }}>
            Atención con <strong style={{ fontWeight: '600' }}>{profesional.full_name || slug}</strong>
          </p>
        </div>

        {/* Contenido principal */}
        <div style={{ padding: '32px 28px' }}>
          <MensajeAlerta mensaje={mensajeAlerta} />
          
          {!pasoPago ? (
            <form onSubmit={handleContinuar} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
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

              <button 
                type="submit" 
                style={{
                  width: '100%',
                  padding: '15px',
                  borderRadius: '14px',
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '15px',
                  marginTop: '6px',
                  boxShadow: '0 10px 15px -3px rgba(2, 132, 199, 0.25)',
                  transition: 'all 0.2s ease'
                }}
              >
                {profesional.requiere_abono && profesional.mp_payment_link ? 'Continuar al pago de abono ➔' : 'Confirmar Reserva'}
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
                    <li>Haz clic en el botón azul para pagar en Mercado Pago.</li>
                    <li>Al terminar, presiona el botón verde para enviar tu comprobante directamente por WhatsApp.</li>
                  </ol>
                </div>
              </div>

              <a
                href={profesional.mp_payment_link}
                target="_blank"
                rel="noopener noreferrer"
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
                  textDecoration: 'none',
                  fontSize: '15px',
                  boxShadow: '0 10px 15px -3px rgba(0, 158, 227, 0.25)',
                  transition: 'transform 0.1s ease'
                }}
              >
                <span>💳</span> Pagar Abono en Mercado Pago
              </a>

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
                  boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.25)',
                  transition: 'transform 0.1s ease'
                }}
              >
                <span>💬</span> {submitting ? 'Procesando cita...' : 'Ya pagué, enviar comprobante por WhatsApp'}
              </button>

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