interface PaymentReceiptProps {
  userName: string
  planName: string
  amount: number
  billingCycle: string
  nextRenewal: string
  invoiceId: string
}

export function paymentReceiptTemplate({ userName, planName, amount, billingCycle, nextRenewal, invoiceId }: PaymentReceiptProps): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0a1e;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <p style="font-size:20px;font-weight:900;color:#a78bfa;letter-spacing:2px;margin:0 0 32px">PASAS.MX</p>
    <h1 style="font-size:22px;font-weight:900;color:#e2d9f3;margin:0 0 16px">Pago confirmado ✓</h1>
    <p style="font-size:15px;color:#a78bfa;margin:0 0 24px">Hola ${userName}, recibimos tu pago correctamente.</p>
    <div style="background:#1a1035;border:1.5px solid #2D2048;border-radius:16px;padding:24px;margin-bottom:24px">
      <p style="font-size:13px;color:#a78bfa;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px">Resumen de pago</p>
      <p style="font-size:15px;color:#e2d9f3;margin:0 0 6px"><strong>Plan:</strong> ${planName}</p>
      <p style="font-size:15px;color:#e2d9f3;margin:0 0 6px"><strong>Monto:</strong> $${amount} MXN</p>
      <p style="font-size:15px;color:#e2d9f3;margin:0 0 6px"><strong>Ciclo:</strong> ${billingCycle}</p>
      <p style="font-size:15px;color:#e2d9f3;margin:0 0 6px"><strong>Próxima renovación:</strong> ${nextRenewal}</p>
      <p style="font-size:13px;color:#a78bfa;margin:12px 0 0;opacity:0.6">ID: ${invoiceId}</p>
    </div>
    <a href="https://pasas.mx/dashboard" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;font-weight:700">Ir a estudiar →</a>
    <p style="font-size:12px;color:#a78bfa;opacity:0.5;margin:32px 0 0">Pasas.mx · Para solicitar factura escríbenos a <a href="mailto:soporte@pasas.mx" style="color:#a78bfa">soporte@pasas.mx</a></p>
  </div>
</body>
</html>`
}
