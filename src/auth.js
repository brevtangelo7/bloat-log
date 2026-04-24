import { supabase, ADMIN_EMAIL } from './supabaseClient.js';

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function getUser() {
  const session = await getSession();
  return session?.user || null;
}

export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    cb(event, session);
  });
  return () => data.subscription.unsubscribe();
}

export async function sendMagicLink(email) {
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function isAdminUser(user) {
  if (!user?.email || !ADMIN_EMAIL) return false;
  return user.email.toLowerCase() === ADMIN_EMAIL;
}
