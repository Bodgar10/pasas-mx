import { redirect } from 'next/navigation'

/** `/admin/metricas` entra por Dinero. Las seis pestañas son rutas propias. */
export default function MetricasIndex() {
  redirect('/admin/metricas/dinero')
}
