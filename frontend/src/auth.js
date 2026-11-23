import { createClient } from '@supabase/supabase-js';
const url = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
export const authConfigured = Boolean(url && key);
export const auth = authConfigured ? createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}).auth : null;
export const authRedirect = () => `${window.location.origin}${window.location.pathname}`;
export async function getAuthSession() {
  if (!auth) return null;
  const { data, error } = await auth.getSession();
  if (error) throw error;
  return data.session;
}
