export default function DashboardLoading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      padding: '0 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '40px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ width: 120, height: 24, backgroundColor: '#1a1035', borderRadius: 8, animation: 'shimmer 1.5s infinite' }} />
          <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#1a1035', animation: 'shimmer 1.5s infinite' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 68, backgroundColor: '#1a1035', borderRadius: 14, animation: 'shimmer 1.5s infinite' }} />
          <div style={{ flex: 1, height: 68, backgroundColor: '#1a1035', borderRadius: 14, animation: 'shimmer 1.5s infinite' }} />
        </div>
        <div style={{ height: 80, backgroundColor: '#1a1035', borderRadius: 14, marginBottom: 20, animation: 'shimmer 1.5s infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: 110, backgroundColor: '#1a1035', borderRadius: 20, animation: 'shimmer 1.5s infinite' }} />
          ))}
        </div>
        <style>{`
          @keyframes shimmer {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    </div>
  )
}
