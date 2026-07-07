// =====================================================================
// CONEXIONAR — Cliente Supabase + helpers de sesión / membresía
// Requiere que config.js y el SDK de Supabase (CDN) se carguen antes.
// =====================================================================
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Redirige a login si no hay sesión activa. Devuelve el usuario si la hay.
async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session.user;
}

// Obtiene el perfil (tabla profiles) del usuario actual.
async function getProfile(userId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) {
    console.error("Error obteniendo perfil:", error);
    return null;
  }
  return data;
}

// Determina si el perfil tiene acceso activo (trial vigente o membresía activa).
function hasActiveAccess(profile) {
  if (!profile) return false;
  if (profile.membership_status === "activo") return true;
  if (profile.membership_status === "trial" && profile.trial_ends_at) {
    return new Date(profile.trial_ends_at) > new Date();
  }
  return false;
}

// Días restantes de trial (0 si ya venció o no aplica).
function trialDaysRemaining(profile) {
  if (!profile || profile.membership_status !== "trial" || !profile.trial_ends_at) return 0;
  const diffMs = new Date(profile.trial_ends_at) - new Date();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}
