// =====================================================================
// CONEXIONAR — Cliente de Supabase (compartido por todas las páginas)
// Requiere que la página haya cargado, en este orden:
//   1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 (SDK)
//   2. assets/config.js (SUPABASE_URL y SUPABASE_ANON_KEY)
// =====================================================================
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Redirige a /login.html si no hay sesión activa. Devuelve el usuario si sí la hay.
async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session.user;
}

// Trae el perfil (incluye membership_status) de la usuaria logueada.
async function getProfile(userId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) {
    console.error("Error cargando perfil:", error);
    return null;
  }
  return data;
}

// ¿Tiene acceso a los videos ahora mismo? (mismo criterio que is_active_member() en SQL)
function hasActiveAccess(profile) {
  if (!profile) return false;
  const now = new Date();
  if (profile.membership_status === "trial") {
    return profile.trial_ends_at && new Date(profile.trial_ends_at) > now;
  }
  if (profile.membership_status === "activo") {
    return !profile.current_period_end || new Date(profile.current_period_end) > now;
  }
  return false;
}

async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}
