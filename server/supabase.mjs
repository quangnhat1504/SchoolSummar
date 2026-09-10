import { createClient } from '@supabase/supabase-js'

export const createSupabaseServerClient = (config = {}) => {
  const url = config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mizueepvtgkmnsyqjxzi.supabase.co'
  const key = config.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Q16YS5Ol699MbBExn0mBRQ_7kd5Bf4D'
  return createClient(url, key, {
    auth: { persistSession: false }
  })
}
