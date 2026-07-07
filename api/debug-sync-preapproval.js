// Endpoint temporal de diagnóstico: sincroniza manualmente el estado de
// una suscripción (preapproval) de MercadoPago con Supabase, para los
// casos en que el webhook no llegó a tiempo (por ejemplo, si se pagó
// antes de configurar la URL del webhook).
// Uso: /api/debug-sync-preapproval?id=<preapproval_id>
// BORRAR este archivo antes de lanzar el sitio a producción.
const { updateProfile, insertPayment } = require("../lib/supabase-admin");

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

module.exports = async (req, res) => {
  try {
    const preapprovalId = req.query.id;
    if (!preapprovalId) return res.status(400).json({ error: "Falta ?id=" });

    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const preapproval = await mpRes.json();

    if (!mpRes.ok) {
      return res.status(502).json({ error: "Error consultando preapproval", detalle: preapproval });
    }

    const userId = preapproval.external_reference;
    if (!userId) return res.status(400).json({ error: "Sin external_reference", preapproval });

    if (preapproval.status === "authorized") {
      const ahora = new Date();
      const finPeriodo = new Date(ahora.getTime() + 31 * 24 * 60 * 60 * 1000);

      await updateProfile(userId, {
        membership_status: "activo",
        plan: "mensual",
        current_period_start: ahora.toISOString(),
        current_period_end: finPeriodo.toISOString(),
        mercadopago_subscription_id: preapproval.id,
      });

      await insertPayment({
        user_id: userId,
        provider: "mercadopago",
        plan: "mensual",
        status: "aprobado",
        amount_clp: preapproval.auto_recurring ? preapproval.auto_recurring.transaction_amount : 16990,
        external_id: preapproval.id,
        raw_payload: preapproval,
      });

      return res.status(200).json({ ok: true, status: preapproval.status, userId });
    }

    return res.status(200).json({ ok: false, status: preapproval.status, mensaje: "No está 'authorized' todavía" });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
