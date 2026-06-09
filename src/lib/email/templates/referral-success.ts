interface ReferralSuccessProps {
  userName: string
  referredName: string
  freeMonthsTotal: number
}

export function referralSuccessTemplate({ userName, referredName, freeMonthsTotal }: ReferralSuccessProps): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0a1e;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <p style="font-size:20px;font-weight:900;color:#a78bfa;letter-spacing:2px;margin:0 0 32px">PASAS.MX</p>
    <h1 style="font-size:22px;font-weight:900;color:#e2d9f3;margin:0 0 16px">¡Tu referido activó su cuenta! 🎉</h1>
    <p style="font-size:15px;color:#a78bfa;margin:0 0 24px">Hola ${userName}, <strong style="color:#e2d9f3">${referredName}</strong> se suscribió usando tu código. ¡Llevas <strong style="color:#10b981">${freeMonthsTotal} ${freeMonthsTotal === 1 ? 'mes gratis' : 'meses gratis'}</strong> acumulados!</p>
    <div style="background:#1a1035;border:1.5px solid #10b98140;border-radius:16px;padding:24px;margin-bottom:24px">
      <p style="font-size:15px;color:#e2d9f3;margin:0">Tu mes gratis se aplicará automáticamente en tu próxima renovación. No tienes que hacer nada.</p>
    </div>
    <a href="https://pasas.mx/referidos" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;font-weight:700">Ver mis referidos →</a>
    <p style="font-size:12px;color:#a78bfa;opacity:0.5;margin:32px 0 0">Pasas.mx · Puedes referir hasta 6 personas por año académico.</p>
  </div>
</body>
</html>`
}
