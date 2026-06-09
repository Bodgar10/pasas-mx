interface BugCreditGrantedProps {
  userName: string
  days: number
  bugDescription: string
}

export function bugCreditGrantedTemplate({ userName, days, bugDescription }: BugCreditGrantedProps): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0a1e;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <p style="font-size:20px;font-weight:900;color:#a78bfa;letter-spacing:2px;margin:0 0 32px">PASAS.MX</p>
    <h1 style="font-size:22px;font-weight:900;color:#e2d9f3;margin:0 0 16px">¡Gracias por el reporte! 🐛</h1>
    <p style="font-size:15px;color:#a78bfa;margin:0 0 24px">Hola ${userName}, revisamos tu reporte y confirmamos el error. Como agradecimiento te damos <strong style="color:#10b981">${days} días gratis</strong>.</p>
    <div style="background:#1a1035;border:1.5px solid #10b98140;border-radius:16px;padding:24px;margin-bottom:24px">
      <p style="font-size:13px;color:#a78bfa;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">Reporte resuelto</p>
      <p style="font-size:14px;color:#e2d9f3;margin:0">${bugDescription}</p>
    </div>
    <a href="https://pasas.mx/dashboard" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#10b981);color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;font-weight:700">Seguir estudiando →</a>
    <p style="font-size:12px;color:#a78bfa;opacity:0.5;margin:32px 0 0">Pasas.mx · Tus días extra ya están aplicados en tu cuenta.</p>
  </div>
</body>
</html>`
}
