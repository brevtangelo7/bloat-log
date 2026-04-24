import { supabase } from './supabaseClient.js';

// ── Row shape ──
// entries (DB): { id, user_id, foods, severity, time_to_bloat, note, created_at }
// App shape:    { id, timestamp, foods, severity, timeToBloat, note }

function toApp(row) {
  return {
    id: row.id,
    timestamp: row.created_at,
    foods: row.foods || '',
    severity: row.severity || '',
    timeToBloat: row.time_to_bloat || '',
    note: row.note || '',
  };
}

function toDb(entry) {
  return {
    foods: entry.foods || null,
    severity: entry.severity || null,
    time_to_bloat: entry.timeToBloat || null,
    note: entry.note || null,
    ...(entry.timestamp ? { created_at: entry.timestamp } : {}),
  };
}

// ── entries ───────────────────────────────────────────
export async function listEntries(userId) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(toApp);
}

export async function createEntry(userId, entry) {
  const row = { user_id: userId, ...toDb(entry) };
  const { data, error } = await supabase
    .from('entries')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return toApp(data);
}

export async function updateEntryRow(id, patch) {
  const { data, error } = await supabase
    .from('entries')
    .update(toDb(patch))
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return toApp(data);
}

export async function deleteEntryRow(id) {
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAllEntries(userId) {
  const { error } = await supabase.from('entries').delete().eq('user_id', userId);
  if (error) throw error;
}

// ── profiles ───────────────────────────────────────────
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertProfile(userId, patch) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...patch })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLastSeen(userId) {
  try {
    await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId);
  } catch {
    // non-fatal
  }
}

export async function deleteProfile(userId) {
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw error;
}

// ── Admin ──────────────────────────────────────────────
export async function adminListProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function adminCountEntries() {
  const { count, error } = await supabase
    .from('entries')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

export async function adminCountEntriesPerUser() {
  // Aggregates client-side (simple and fine at small scale).
  const { data, error } = await supabase
    .from('entries')
    .select('user_id');
  if (error) throw error;
  const counts = {};
  (data || []).forEach(r => { counts[r.user_id] = (counts[r.user_id] || 0) + 1; });
  return counts;
}

export async function adminSetDisabled(userId, disabled) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_disabled: disabled })
    .eq('id', userId);
  if (error) throw error;
}
