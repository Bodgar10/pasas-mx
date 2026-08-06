interface WelcomeProps {
  /** Nombre del ALUMNO. En users.full_name, siempre. */
  studentName: string
  /** Nombre del TUTOR (users.parent_name). Vacío si el titular es el alumno mayor de edad. */
  parentName?: string | null
  planName: string
  trialEndsAt: string
  /** En PESOS, ya divididos entre 100. */
  amount: number
  /** 'Mensual' | 'Semestral' | 'Anual' — de CICLO_LABEL. */
  billingCycle: string
}

export function welcomeTemplate({
  studentName, parentName, planName, trialEndsAt, amount, billingCycle,
}: WelcomeProps): string {
  /**
   * Dos destinatarios posibles. El correo llega al buzón de quien paga:
   * si hay tutor, se le habla a él y el alumno se menciona en tercera
   * persona; si no, titular y alumno son la misma persona.
   *
   * No hardcodear estos copys en el HTML de abajo — misma regla que COPY
   * en el onboarding.
   */
  const hayTutor = !!parentName?.trim()
  const saludo = hayTutor
    ? `¡Todo listo, ${parentName!.trim()}!`
    : '¡Ya estás dentro! 🎮'
  const intro = hayTutor
    ? `La cuenta de <strong style="color:#e2d9f3">${studentName}</strong> ya está activa. Tiene 7 días gratis para explorar todo.`
    : `Hola ${studentName}, bienvenido a Pasas.mx. Tienes 7 días gratis para explorar todo.`

  const CADA: Record<string, string> = {
    Mensual: 'cada mes',
    Semestral: 'cada 6 meses',
    Anual: 'cada año',
  }
  const periodicidad = CADA[billingCycle] ?? 'cada periodo'

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0a1e;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <p style="font-size:20px;font-weight:900;color:#a78bfa;letter-spacing:2px;margin:0 0 32px">PASAS.MX</p>
    <h1 style="font-size:22px;font-weight:900;color:#e2d9f3;margin:0 0 16px">${saludo}</h1>
    <p style="font-size:15px;color:#a78bfa;margin:0 0 24px">${intro}</p>
    <div style="background:#1a1035;border:1.5px solid #2D2048;border-radius:16px;padding:24px;margin-bottom:24px">
      <p style="font-size:13px;color:#a78bfa;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">Tu plan</p>
      <p style="font-size:15px;color:#e2d9f3;margin:0 0 6px"><strong>${planName}</strong></p>
      <p style="font-size:15px;color:#e2d9f3;margin:0 0 6px"><strong>${billingCycle}</strong> · $${amount} MXN ${periodicidad}</p>
      <p style="font-size:14px;color:#a78bfa;margin:0">Prueba gratis hasta el <strong style="color:#e2d9f3">${trialEndsAt}</strong></p>
      <p style="font-size:14px;color:#a78bfa;margin:8px 0 0">El primer cargo de $${amount} MXN se hará ese día. Puedes cancelar antes sin ningún costo.</p>
    </div>
    <a href="https://pasas.mx/dashboard" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;font-weight:700">Ir a mi dashboard →</a>
    <p style="font-size:12px;color:#a78bfa;opacity:0.5;margin:32px 0 0">Pasas.mx · <a href="https://pasas.mx/como-cancelar" style="color:#a78bfa">¿Cómo cancelo?</a> · <a href="mailto:soporte@pasas.mx" style="color:#a78bfa">soporte@pasas.mx</a></p>
  </div>
</body>
</html>`
}
