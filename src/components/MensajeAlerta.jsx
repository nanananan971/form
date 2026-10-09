export function MensajeAlerta({ mensaje }) {
  if (!mensaje) return null;

  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '14px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontSize: '14px', fontWeight: '500' }}>
      ✅ {mensaje}
    </div>
  );
}