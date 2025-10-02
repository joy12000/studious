import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLICSUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLICSUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing. Make sure to set VITE_PUBLICSUPABASE_URL and VITE_PUBLICSUPABASE_ANON_KEY in your .env file.");
}

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!);