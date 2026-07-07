// =====================================================================
// CONEXIONAR — POST /api/webhook-mercadopago
// =====================================================================
// MercadoPago llama a esta URL automáticamente cada vez que cambia el
// estado de una suscripción (preapproval). Hay que registrar esta URL
// en el panel de MercadoPago: Tu aplicación → Webhooks → agregar
// https://nuevo.conexionar.com/api/webhook-mercadopago
// (evento a escuchar: "Suscripciones" / "preapproval")
// =====================================================================
const { updateProfile, insertPayment, findProfileByField } = require("../lib/supabase-admin");

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(200).send("ok"); // MP a veces prueba con GET, respondemos OK igual
  }

  try {
    const { type, data } = req.body || {};

    // Solo nos interesan las notificaciones de suscripción (preapproval)
    if (type !== "subscription_preapproval" && type !== "preapproval") {
      return res.status(200).send("ignorado");
    }

    const preapprovalId = data && data.id;
    if (!preapprovalId) return res.status(200).send("sin id");

    // Consultamos el estado real y completo de la suscripción a MercadoPago
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const preapproval = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Error consultando preapproval:", preapproval);
      return res.status(200).send("error consultando MP");
    }

    const userId = preapproval.external_reference;
    if (!userId) return res.status(200).send("sin external_reference");

    if (preapproval.status === "authorized") {
      // Pago autorizado: la usuaria queda con membresía activa por 1 mes.
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
    } else if (preapproval.status === "cancelled" || preapproval.status === "paused") {
      await updateProfile(userId, { membership_status: "cancelado" });
    }

    return res.status(200).send("ok");
  } catch (err) {
    console.error("Error en webhook-mercadopago:", err);
    // Respondemos 200 igual para que MercadoPago no siga reintentando indefinidamente
    // mientras investigamos el error en los logs de Vercel.
    return res.status(200).send("error interno, revisar logs");
  }
};
