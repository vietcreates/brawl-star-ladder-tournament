import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const online = Boolean(url && key);
export const supabase = online ? createClient(url!, key!) : null;

export const TABLE = 'tournament_state';
export const ROW_ID = 'main';
