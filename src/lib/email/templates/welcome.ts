interface WelcomeProps {
  userName: string
  planName: string
  trialEndsAt: string
}

export function welcomeTemplate({ userName, planName, trialEndsAt }: WelcomeProps): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0a1e;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <p style="font-size:20px;font-weight:900;color:#a78bfa;letter-spacing:2px;margin:0 0 32px">PASAS.MX</p>
    <h1 style="font-size:22px;font-weight:900;color:#e2d9f3;margin:0 0 16px">¡Ya estás dentro! 🎮</h1>
    <p style="font-size:15px;color:#a78bfa;margin:0 0 24px">Hola ${userName}, bienvenido a Pasas.mx. Tienes 7 días gratis para explorar todo.</p>
    <div style="background:#1a1035;border:1.5px solid #2D2048;border-radius:16px;padding:24px;margin-bottom:24px">
      <p style="font-size:13px;color:#a78bfa;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">Tu plan</p>
      <p style="font-size:15px;color:#e2d9f3;margin:0 0 6px"><strong>${planName}</strong></p>
      <p style="font-size:14px;color:#a78bfa;margin:0">Prueba gratis hasta el <strong style="color:#e2d9f3">${trialEndsAt}</strong></p>
    </div>
    <a href="https://pasas.mx/dashboard" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;font-weight:700">Ir a mi dashboard →</a>
    <p style="font-size:12px;color:#a78bfa;opacity:0.5;margin:32px 0 0">Pasas.mx · <a href="mailto:soporte@pasas.mx" style="color:#a78bfa">soporte@pasas.mx</a></p>
  </div>
</body>
</html>`
}
