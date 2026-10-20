import { useState } from 'react';

export function SelectorHorarios({ slotSeleccionado, onChange, horariosDisponibles }) {
  const ahora = new Date();
  const [jornada, setJornada] = useState('todos'); // 'todos', 'manana', 'tarde'

  // Filtrar los slots para que no se muestren los que ya pasaron
  const horariosValidos = horariosDisponibles.filter(slot => {
    const [year, month, day] = slot.slot_date.split('-').map(Number);
    const [hours, minutes] = slot.start_time.split(':').map(Number);
    const fechaSlot = new Date(year, month - 1, day, hours, minutes);
    return fechaSlot > ahora;
  });

  // Agrupar por fecha
  const slotsPorFecha = horariosValidos.reduce((acc, slot) => {
    if (!acc[slot.slot_date]) {
      acc[slot.slot_date] = [];
    }
    acc[slot.slot_date].push(slot);
    return acc;
  }, {});

  const fechas = Object.keys(slotsPorFecha);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(fechas[0] || '');

  // Filtrar slots por jornada (Mañana / Tarde)
  const slotsDelDia = (slotsPorFecha[fechaSeleccionada] || []).filter(slot => {
    const horaNum = parseInt(slot.start_time.split(':')[0], 10);
    if (jornada === 'manana') return horaNum < 13;
    if (jornada === 'tarde') return horaNum >= 13;
    return true;
  });

  const formatearFechaLegible = (fechaStr) => {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
    const formateada = date.toLocaleDateString('es-ES', opciones);
    return formateada.charAt(0).toUpperCase() + formateada.slice(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' }}>
      
      {/* SECCIÓN 1: Selección de Fecha */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <label style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📅</span> Selecciona un día:
          </label>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
            {fechas.length} días disponibles
          </span>
        </div>

        {fechas.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: '14px', padding: '24px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            No hay horarios disponibles por el momento.
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            overflowX: 'auto', 
            paddingBottom: '10px',
            paddingTop: '2px',
            scrollbarWidth: 'thin',
            WebkitOverflowScrolling: 'touch'
          }}>
            {fechas.map((fecha) => {
              const [year, month, day] = fecha.split('-').map(Number);
              const date = new Date(year, month - 1, day);
              const nombreDia = date.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
              const numeroDia = date.getDate();
              const nombreMes = date.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
              
              const isSelected = fechaSeleccionada === fecha;

              return (
                <button
                  key={fecha}
                  type="button"
                  onClick={() => setFechaSeleccionada(fecha)}
                  style={{
                    minWidth: '78px',
                    padding: '12px 8px',
                    borderRadius: '16px',
                    border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                    background: isSelected ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 10px 20px -5px rgba(2, 132, 199, 0.4)' : '0 2px 4px rgba(0,0,0,0.02)',
                    flexShrink: 0
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.8px', opacity: isSelected ? 0.9 : 0.6 }}>{nombreDia}</span>
                  <span style={{ fontSize: '22px', fontWeight: '800', lineHeight: '1.1' }}>{numeroDia}</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', opacity: isSelected ? 0.9 : 0.5 }}>{nombreMes}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SECCIÓN 2: Filtros de Jornada y Selección de Hora */}
      {fechas.length > 0 && (
        <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
              ⏰ Horarios — {formatearFechaLegible(fechaSeleccionada)}
            </span>

            {/* Píldoras de Filtro Mañana / Tarde */}
            <div style={{ display: 'flex', background: '#e2e8f0', padding: '3px', borderRadius: '10px', gap: '2px' }}>
              <button
                type="button"
                onClick={() => setJornada('todos')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: jornada === 'todos' ? '#ffffff' : 'transparent',
                  color: jornada === 'todos' ? '#0284c7' : '#64748b',
                  fontWeight: '700',
                  fontSize: '11px',
                  cursor: 'pointer',
                  boxShadow: jornada === 'todos' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setJornada('manana')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: jornada === 'manana' ? '#ffffff' : 'transparent',
                  color: jornada === 'manana' ? '#0284c7' : '#64748b',
                  fontWeight: '700',
                  fontSize: '11px',
                  cursor: 'pointer',
                  boxShadow: jornada === 'manana' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                ☀️ Mañana
              </button>
              <button
                type="button"
                onClick={() => setJornada('tarde')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: jornada === 'tarde' ? '#ffffff' : 'transparent',
                  color: jornada === 'tarde' ? '#0284c7' : '#64748b',
                  fontWeight: '700',
                  fontSize: '11px',
                  cursor: 'pointer',
                  boxShadow: jornada === 'tarde' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                🌙 Tarde
              </button>
            </div>
          </div>

          {/* Grilla de Bloques de Hora */}
          {slotsDelDia.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: '12px 0' }}>
              No hay horarios disponibles en este bloque.
            </p>
          ) : (
            <div style={{ 
              maxHeight: '220px', 
              overflowY: 'auto', 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))',
              gap: '10px',
              paddingRight: '4px'
            }}>
              {slotsDelDia.map((slot, index) => {
                const valorSlot = `${slot.slot_date}|${slot.start_time}`;
                const isSelected = slotSeleccionado === valorSlot;
                const isOcupado = slot.is_booked;

                return (
                  <button
                    key={index}
                    type="button"
                    disabled={isOcupado}
                    onClick={() => !isOcupado && onChange(valorSlot)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: isOcupado ? '#f1f5f9' : isSelected ? '#0284c7' : '#ffffff',
                      color: isOcupado ? '#94a3b8' : isSelected ? '#ffffff' : '#0f172a',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: isOcupado ? 'not-allowed' : 'pointer',
                      opacity: isOcupado ? 0.5 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 6px 15px rgba(2, 132, 199, 0.35)' : '0 1px 2px rgba(0,0,0,0.03)',
                      position: 'relative'
                    }}
                  >
                    <span>{slot.start_time.slice(0, 5)} hrs</span>
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: '600', 
                      color: isOcupado ? '#ef4444' : isSelected ? '#e0f2fe' : '#10b981' 
                    }}>
                      {isOcupado ? 'Ocupado' : 'Disponible'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}