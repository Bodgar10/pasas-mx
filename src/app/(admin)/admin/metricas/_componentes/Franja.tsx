import { StatCard, COLORES } from '@/components/admin/Tarjetas'
import { cargarFranja, pesos } from '../_lib/datos'

/**
 * El estado del negocio en dos segundos, igual en las seis pestañas.
 *
 * Es un componente de SERVIDOR con su propia consulta, y va dentro de cada
 * página en vez de en el layout: `layout.tsx` no recibe `searchParams`, así
 * que ahí no podría saber si el toggle de cuentas de prueba está encendido.
 */
export default async function Franja({ incluirPrueba }: { incluirPrueba: boolean }) {
  const f = await cargarFranja(incluirPrueba)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        padding: '16px',
        background: COLORES.fondo2,
        border: `1px solid ${COLORES.borde}`,
        borderRadius: 18,
        marginBottom: 8,
      }}
    >
      <StatCard label="MRR" value={pesos(f.mrr)} sub={`${f.cuentasActivas} cuentas activas`} color={COLORES.verde} />
      <StatCard label="Cuentas activas" value={f.cuentasActivas} color={COLORES.primario} />
      <StatCard
        label="Churn 30d"
        value={`${f.churn30}%`}
        sub={`${f.canceladas30} canceladas`}
        color={f.churn30 > 10 ? COLORES.rojo : COLORES.ambar}
      />
      <StatCard label="Nuevos 30d" value={f.nuevos30} sub="cuentas creadas" color={COLORES.cian} />
    </div>
  )
}
