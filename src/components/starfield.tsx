/**
 * Fondo de estrellas del layout raíz.
 *
 * Componente de SERVIDOR y sin estado: todo el dibujo y el titileo viven en
 * la clase `.starfield` de src/app/globals.css (radial-gradients con
 * posiciones fijas). Ver la nota de allá para el porqué — s34.
 *
 * 🔴 NO vuelvas a generar estrellas con Math.random() en el render: el
 * servidor y el cliente sacan números distintos y la hidratación no casa.
 */
export default function Starfield() {
  return <div className="starfield" aria-hidden="true" />
}
