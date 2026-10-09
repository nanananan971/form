export function CamposFormulario({ label, type, value, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={onChange} 
        placeholder={placeholder}
        required 
        style={{ 
          width: '100%', 
          padding: '12px 14px', 
          borderRadius: '8px', 
          border: '1px solid #cbd5e1', 
          background: '#ffffff', 
          color: '#0f172a',
          fontSize: '14px',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      />
    </div>
  );
}