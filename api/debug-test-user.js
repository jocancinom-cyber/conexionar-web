// Endpoint temporal de diagnóstico: muestra los datos de una cuenta de
// prueba de MercadoPago (incluyendo su email real) para poder usarla
// como payer_email al probar la suscripción en sandbox.
// Uso: /api/debug-test-user?id=3526641644
// BORRAR este archivo antes de lanzar el sitio a producción.
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

module.exports = async (req, res) => {
  try {
    const userId = req.query.id;
    if (!userId) return res.status(400).json({ error: "Falta ?id=" });

    const r = await fetch(`https://api.mercadopago.com/users/${userId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
