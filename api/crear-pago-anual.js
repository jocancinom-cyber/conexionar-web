// =====================================================================
// CONEXIONAR — POST /api/crear-pago-anual
// =====================================================================
// Crea una transacción Webpay Plus para el plan anual ($119.880 CLP,
// pago único). Usa el SDK oficial de Transbank para Node.js.
//
// Por defecto usa el ambiente de INTEGRACIÓN (pruebas) de Transbank con
// las credenciales públicas de test. Cuando estemos listas para cobrar
// de verdad, cambiamos WEBPAY_ENVIRONMENT a "production" y agregamos el
// Commerce Code y API Key reales como variables de entorno.
// =====================================================================
const { WebpayPlus, Options, Environment, IntegrationCommerceCodes, IntegrationApiKeys } = require("transbank-sdk");
const { getUserFromToken } = require("../lib/supabase-admin");

const PRECIO_ANUAL = 119880;
const SITE_URL = process.env.SITE_URL || "https://nuevo.conexionar.com";

function getWebpayOptions() {
  const isProduction = process.env.WEBPAY_ENVIRONMENT === "production";
  if (isProduction) {
    return new Options(
      process.env.WEBPAY_COMMERCE_CODE,
      process.env.WEBPAY_API_KEY,
      Environment.Production
    );
  }
  // Ambiente de pruebas: credenciales públicas de integración de Transbank.
  return new Options(
    IntegrationCommerceCodes.WEBPAY_PLUS,
    IntegrationApiKeys.WEBPAY,
    Environment.Integration
  );
}

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

    const buyOrder = `anual-${Date.now()}`;
    // sessionId codifica el userId para poder recuperarlo en la confirmación.
    const sessionId = user.id;
    const returnUrl = `${SITE_URL}/api/confirmar-webpay`;

    const tx = new WebpayPlus.Transaction(getWebpayOptions());
    const createResponse = await tx.create(buyOrder, sessionId, PRECIO_ANUAL, returnUrl);

    return res.status(200).json({ url: createResponse.url, token: createResponse.token });
  } catch (err) {
    console.error("Error en crear-pago-anual:", err);
    return res.status(500).json({ error: "Error creando el pago con Webpay. Intenta de nuevo." });
  }
};
