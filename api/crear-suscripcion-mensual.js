// =====================================================================
// CONEXIONAR — POST /api/crear-suscripcion-mensual
// =====================================================================
// Crea una suscripción (preapproval) en MercadoPago para el plan mensual
// ($16.990 CLP/mes) y devuelve el link de pago al que hay que redirigir
// a la usuaria.
//
// El frontend debe llamar a este endpoint con:
//   Authorization: Bearer <access_token de la sesión de Supabase>
// =====================================================================
const { getUserFromToken, updateProfile } = require("../lib/supabase-admin");

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const SITE_URL = process.env.SITE_URL || "https://nuevo.conexionar.com";
const PRECIO_MENSUAL = 16990;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({ error: "Sesión inválida. Inicia sesión de nuevo." });
    }

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: "Conexionar — Plan Mensual",
        external_reference: user.id,
        payer_email: user.email,
        back_url: `${SITE_URL}/app.html?pago=exito`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: PRECIO_MENSUAL,
          currency_id: "CLP",
        },
        status: "pending",
      }),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Error MercadoPago:", mpData);
      return res.status(502).json({ error: "No pudimos crear la suscripción en MercadoPago.", detalle: mpData });
    }

    // Guardamos el ID de la suscripción en el perfil, aunque todavía esté "pending".
    // El webhook la va a marcar como "activo" cuando la usuaria complete el pago.
    await updateProfile(user.id, {
      mercadopago_subscription_id: mpData.id,
      plan: "mensual",
    });

    // Con credenciales de PRUEBA, usar sandbox_init_point; con credenciales
    // reales, MercadoPago no devuelve sandbox_init_point y usamos init_point.
    const linkDePago = mpData.sandbox_init_point || mpData.init_point;

    return res.status(200).json({ url: linkDePago });
  } catch (err) {
    console.error("Error en crear-suscripcion-mensual:", err);
    return res.status(500).json({ error: "Error inesperado. Intenta de nuevo." });
  }
};
