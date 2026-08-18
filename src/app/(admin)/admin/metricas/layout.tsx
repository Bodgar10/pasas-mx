import Link from 'next/link'
import Pestanas from './_componentes/Pestanas'
import { servicio } from './_lib/datos'
import { COLORES } from '@/components/admin/Tarjetas'

/**
 * Shell del tablero: cabecera y pestañas. NO carga datos de negocio.
 *
 * 🔴 El layout no recibe `searchParams` en el App Router, así que aquí no se
 * puede saber si el toggle está encendido. Todo lo que dependa de él —franja
 * fija incluida— vive dentro de cada página.
 *
 * Lo único que se consulta aquí es cuántas cuentas de prueba hay, que no
 * depende del toggle y evita repetir esa cuenta en las seis pestañas.
 */
export default async function MetricasLayout({ children }: { children: React.ReactNode }) {
  const { count } = await servicio()
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('is_test', true)

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 80px', fontFamily: 'var(--font-nunito)', color: COLORES.texto }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <Link
          href="/admin"
          style={{ width: 36, height: 36, borderRadius: 10, background: COLORES.fondo, border: `1px solid ${COLORES.borde}`, color: COLORES.suave, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}
        >
          ←
        </Link>
        <div>
          <div style={{ fontFamily: 'var(--font-orbitron)', fontSize: 20, fontWeight: 900 }}>📊 Métricas</div>
          <div style={{ fontSize: 13, color: COLORES.suave }}>Datos en tiempo real desde Supabase</div>
        </div>
      </div>

      <Pestanas cuentasDePrueba={count ?? 0} />
      {children}
    </div>
  )
}
