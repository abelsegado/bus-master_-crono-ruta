import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vfybzlzoebtovspbbkll.supabase.co'
const supabaseAnonKey = 'sb_publishable_lzbT_s8RqnfPk85qo3GhuQ_9C4t0FQ6'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)