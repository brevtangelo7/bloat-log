import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn('[bloat-log] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Create a .env from .env.example.');
}

export const supabase = createClient(url || 'http://placeholder.invalid', key || 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase();
