export default function Loading() {
  return (
    <div style={{
      maxWidth: 440,
      margin: '0 auto',
      fontFamily: 'var(--font-nunito)',
      color: '#e2d9f3',
      minHeight: '100vh',
    }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -300px 0; }
          100% { background-position: 300px 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, #1a1035 25%, #2D2048 50%, #1a1035 75%);
          background-size: 300px 100%;
          animation: shimmer 1.5s infinite linear;
          border-radius: 8px;
        }
      `}</style>

      <div style={{
        background: '#0f0a1e',
        borderBottom: '1px solid rgba(124,58,237,0.15)',
        padding: '18px 16px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1a1035', border: '1px solid #2D2048' }} />
        <div style={{ flex: 1 }}>
          <div className="shimmer" style={{ height: 10, width: 80, marginBottom: 6 }} />
          <div className="shimmer" style={{ height: 14, width: 180 }} />
        </div>
        <div className="shimmer" style={{ width: 70, height: 28, borderRadius: 50 }} />
      </div>

      <div style={{ borderBottom: '1px solid rgba(124,58,237,0.15)', padding: '0 16px', display: 'flex' }}>
        {['Guía', 'Quiz', 'Resumen'].map(tab => (
          <div key={tab} style={{ flex: 1, padding: '10px 0', display: 'flex', justifyContent: 'center' }}>
            <div className="shimmer" style={{ height: 14, width: 50 }} />
          </div>
        ))}
      </div>

      <div style={{ padding: 16, paddingLeft: 52, position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 28, top: 20, bottom: 20,
          width: 1, background: 'rgba(124,58,237,0.2)',
        }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ marginBottom: 16, position: 'relative' }}>
            <div style={{
              position: 'absolute', left: -24, top: 14,
              width: 18, height: 18, borderRadius: '50%',
              background: '#1a1035', border: '2px solid #2D2048',
            }} />
            <div style={{
              background: '#1a1035', border: '1px solid rgba(124,58,237,0.15)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 16px', background: 'rgba(124,58,237,0.06)', borderBottom: '1px solid rgba(124,58,237,0.1)' }}>
                <div className="shimmer" style={{ height: 10, width: 100 }} />
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="shimmer" style={{ height: 12, width: '100%' }} />
                <div className="shimmer" style={{ height: 12, width: '90%' }} />
                <div className="shimmer" style={{ height: 12, width: '75%' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
