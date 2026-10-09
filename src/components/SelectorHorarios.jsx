import { useState } from 'react';

export function SelectorHorarios({ slotSeleccionado, onChange, horariosDisponibles }) {
  // Agrupar los slots por fecha
  const slotsPorFecha = horariosDisponibles.reduce((acc, slot) => {
    if (!acc[slot.slot_date]) {
      acc[slot.slot_date] = [];
    }
    acc[slot.slot_date].push(slot);
    return acc;
  }, {});

  const fechas = Object.keys(slotsPorFecha);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(fechas[0] || '');

  // Formatear fecha para que se vea bonita (Ej: "Viernes, 9 de Octubre")
  const formatearFechaLegible = (fechaStr) => {
    const [year, month, day] = fechaStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
    const formateada = date.toLocaleDateString('es-ES', opciones);
    // Capitalizar primera letra
    return formateada.charAt(0).toUpperCase() + formateada.slice(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <label style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
        Selecciona una fecha:
      </label>

      {fechas.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px', padding: '20px', background: '#f8fafc', borderRadius: '10px' }}>
          No hay horarios disponibles por el momento.
        </p>
      ) : (
        <>
          {/* Carrusel o grilla de días */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            overflowX: 'auto', 
            paddingBottom: '4px',
            scrollbarWidth: 'thin'
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
                    minWidth: '72px',
                    padding: '10px 8px',
                    borderRadius: '12px',
                    border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                    background: isSelected ? '#e0f2fe' : '#ffffff',
                    color: isSelected ? '#0369a1' : '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 4px 6px -1px rgba(2, 132, 199, 0.1)' : 'none'
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>{nombreDia}</span>
                  <span style={{ fontSize: '18px', fontWeight: '800' }}>{numeroDia}</span>
                  <span style={{ fontSize: '10px', fontWeight: '600', color: isSelected ? '#0284c7' : '#94a3b8' }}>{nombreMes}</span>
                </button>
              );
            })}
          </div>

          <label style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginTop: '6px' }}>
            Horarios para el {formatearFechaLegible(fechaSeleccionada)}:
          </label>

          {/* Lista de horas para el día seleccionado */}
          <div style={{ 
            maxHeight: '220px', 
            overflowY: 'auto', 
            border: '1px solid #e2e8f0', 
            borderRadius: '12px', 
            padding: '12px', 
            background: '#f8fafc',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '8px',
            alignContent: 'start'
          }}>
            {(slotsPorFecha[fechaSeleccionada] || []).map((slot, index) => {
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
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: isOcupado ? '#f1f5f9' : isSelected ? '#e0f2fe' : '#ffffff',
                    color: isOcupado ? '#94a3b8' : '#0f172a',
                    fontSize: '13px',
                    fontWeight: isSelected ? '700' : '500',
                    textAlign: 'center',
                    cursor: isOcupado ? 'not-allowed' : 'pointer',
                    opacity: isOcupado ? 0.5 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 2px 4px rgba(2, 132, 199, 0.15)' : 'none'
                  }}
                >
                  <span style={{ fontSize: '14px' }}>⏰ {slot.start_time.slice(0, 5)} hrs.</span>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: '600', 
                    color: isOcupado ? '#ef4444' : '#10b981' 
                  }}>
                    {isOcupado ? 'Ocupado' : 'Disponible'}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}