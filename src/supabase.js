import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ydskauniiggmkkdrlzcl.supabase.co';
const supabaseKey = 'sb_publishable_g7H6HLdYKsOPUhB42O9MJA_Fdiaxr8r';

export const supabase = createClient(supabaseUrl, supabaseKey);