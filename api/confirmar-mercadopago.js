// =====================================================================
// CONEXIONAR — GET /api/confirmar-mercadopago
// =====================================================================
// MercadoPago redirige el navegador de la usuaria a esta URL después de
// completar (o cancelar) el pago de la suscripción mensual, agregando
// "preapproval_id" como parámetro en la URL. Acá consultamos el estado
// real de esa suscripción directamente a la API de MercadoPago y, si
// está autorizada, activamos la membresía de inmediato — sin depender
// del webhook asíncrono (que en el ambiente de pruebas de MercadoPago
// no siempre llega).
//
// El webhook (api/webhook-mercadopago.js) se mantiene activo como
// respaldo, sobre todo para renovaciones y cancelaciones futuras.
// =====================================================================
const { updateProfile, insertPayment } = require("../lib/supabase-admin");

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const SITE_URL = process.env.SITE_URL || "https://nuevo.conexionar.com";

module.exports = async (req, res) => {
  try {
    const preapprovalId = req.query.preapproval_id;

    if (!preapprovalId) {
      return res.redirect(302, `${SITE_URL}/app.html?pago=cancelado`);
    }

    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const preapproval = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Error consultando preapproval en confirmar-mercadopago:", preapproval);
      return res.redirect(302, `${SITE_URL}/app.html?pago=error`);
    }

    const userId = preapproval.external_reference;
    if (!userId) {
      return res.redirect(302, `${SITE_URL}/app.html?pago=error`);
    }

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

      return res.redirect(302, `${SITE_URL}/app.html?pago=exito`);
    }

    // Todavía "pending" u otro estado: no activamos, mandamos a la usuaria
    // de vuelta con un mensaje neutro (no fue rechazo, puede que la
    // autorización tarde unos segundos más).
    return res.redirect(302, `${SITE_URL}/app.html?pago=rechazado`);
  } catch (err) {
    console.error("Error en confirmar-mercadopago:", err);
    return res.redirect(302, `${SITE_URL}/app.html?pago=error`);
  }
};
