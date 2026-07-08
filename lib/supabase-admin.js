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

// Trae todas las filas de class_videos (class_id + vimeo_id), bypassando RLS.
async function getAllClassVideos() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/class_videos?select=class_id,vimeo_id`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) return [];
  return res.json();
}

// Actualiza el thumbnail_url de una clase (tabla pública "classes").
async function updateClassThumbnail(classId, thumbnailUrl) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/classes?id=eq.${classId}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ thumbnail_url: thumbnailUrl }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error actualizando thumbnail: ${res.status} ${text}`);
  }
}

// Crea una fila nueva en "classes" y devuelve la fila creada (con su id).
async function insertClass(fields) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/classes`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error creando clase: ${res.status} ${text}`);
  }
  const rows = await res.json();
  return rows[0];
}

// Vincula el video de Vimeo a una clase (tabla protegida "class_videos").
async function insertClassVideo(classId, vimeoId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/class_videos`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ class_id: classId, vimeo_id: String(vimeoId) }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error vinculando video: ${res.status} ${text}`);
  }
}

module.exports = { getUserFromToken, updateProfile, findProfileByField, insertPayment, getAllClassVideos, updateClassThumbnail, insertClass, insertClassVideo };
