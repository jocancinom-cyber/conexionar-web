// =====================================================================
// CONEXIONAR — Helper de Supabase para las funciones serverless (backend)
// =====================================================================
// Usa fetch directo a la API REST de Supabase, sin dependencias externas.
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY deben estar
// configuradas como variables de entorno en Vercel (Project Settings →
// Environment Variables). La service_role key NUNCA debe usarse en el
// frontend, solo acá (código que corre en el servidor de Vercel).
// =====================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Verifica el token de sesión (JWT) que manda el frontend y devuelve la usuaria.
async function getUserFromToken(accessToken) {
  if (!accessToken) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) return null;
  return res.json(); // { id, email, ... }
}

// Actualiza una fila de profiles (bypassa RLS con la service_role key).
async function updateProfile(userId, fields) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error actualizando perfil: ${res.status} ${text}`);
  }
}

// Busca un perfil por su mercadopago_subscription_id (para el webhook).
async function findProfileByField(field, value) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?${field}=eq.${encodeURIComponent(value)}&select=*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] || null;
}

// Inserta una fila en la bitácora de pagos.
async function insertPayment(fields) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error guardando pago: ${res.status} ${text}`);
  }
}

module.exports = { getUserFromToken, updateProfile, findProfileByField, insertPayment };
