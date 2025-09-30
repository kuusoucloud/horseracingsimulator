import { createClient } from '@supabase/supabase-js'

// Create a function to get the Supabase client safely
export const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not found. Running in offline mode.')
    return null
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

// Only create the client if we're in the browser and have the required env vars
export const supabase = typeof window !== 'undefined' ? getSupabaseClient() : null

export type RaceState = 'pre-race' | 'countdown' | 'racing' | 'finished'

export interface SyncedRaceData {
  id: string
  race_state: RaceState
  horses: any[]
  race_progress: Record<string, number>
  pre_race_timer: number
  race_results: any[]
  created_at: string
  updated_at: string
}