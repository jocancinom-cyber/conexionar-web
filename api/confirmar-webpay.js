// =====================================================================
// CONEXIONAR — POST/GET /api/confirmar-webpay
// =====================================================================
// Transbank redirige el navegador de la usuaria a esta URL después del
// pago (enviando "token_ws" por POST). Acá confirmamos la transacción
// con Transbank y, si fue aprobada, activamos la membresía anual en
// Supabase. Al final, redirigimos a la usuaria de vuelta al sitio.
// =====================================================================
const { WebpayPlus, Options, Environment, IntegrationCommerceCodes, IntegrationApiKeys } = require("transbank-sdk");
const { updateProfile, insertPayment } = require("../lib/supabase-admin");

const SITE_URL = process.env.SITE_URL || "https://nuevo.conexionar.com";
const PRECIO_ANUAL = 119880;

function getWebpayOptions() {
  const isProduction = process.env.WEBPAY_ENVIRONMENT === "production";
  if (isProduction) {
    return new Options(
      process.env.WEBPAY_COMMERCE_CODE,
      process.env.WEBPAY_API_KEY,
      Environment.Production
    );
  }
  return new Options(
    IntegrationCommerceCodes.WEBPAY_PLUS,
    IntegrationApiKeys.WEBPAY,
    Environment.Integration
  );
}

module.exports = async (req, res) => {
  try {
    const tokenWs = (req.body && req.body.token_ws) || req.query.token_ws;

    if (!tokenWs) {
      return res.redirect(302, `${SITE_URL}/app.html?pago=cancelado`);
    }

    const tx = new WebpayPlus.Transaction(getWebpayOptions());
    const commitResponse = await tx.commit(tokenWs);

    const userId = commitResponse.session_id;
    const pagoAprobado = commitResponse.response_code === 0 || commitResponse.status === "AUTHORIZED";

    if (pagoAprobado && userId) {
      const ahora = new Date();
      const finPeriodo = new Date(ahora.getTime() + 365 * 24 * 60 * 60 * 1000);

      await updateProfile(userId, {
        membership_status: "activo",
        plan: "anual",
        current_period_start: ahora.toISOString(),
        current_period_end: finPeriodo.toISOString(),
        webpay_last_order_id: commitResponse.buy_order,
      });

      await insertPayment({
        user_id: userId,
        provider: "webpay",
        plan: "anual",
        status: "aprobado",
        amount_clp: PRECIO_ANUAL,
        external_id: commitResponse.buy_order,
        raw_payload: commitResponse,
      });

      return res.redirect(302, `${SITE_URL}/app.html?pago=exito`);
    }

    if (userId) {
      await insertPayment({
        user_id: userId,
        provider: "webpay",
        plan: "anual",
        status: "rechazado",
        amount_clp: PRECIO_ANUAL,
        external_id: commitResponse.buy_order || null,
        raw_payload: commitResponse,
      });
    }

    return res.redirect(302, `${SITE_URL}/app.html?pago=rechazado`);
  } catch (err) {
    console.error("Error en confirmar-webpay:", err);
    return res.redirect(302, `${SITE_URL}/app.html?pago=error`);
  }
};
