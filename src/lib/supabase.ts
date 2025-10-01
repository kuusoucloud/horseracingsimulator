import { createClient } from '@supabase/supabase-js'

// Singleton pattern to ensure only one Supabase client instance
let supabaseInstance: ReturnType<typeof createClient> | null = null

// Create a function to get the Supabase client safely
export const getSupabaseClient = () => {
  // Return existing instance if available
  if (supabaseInstance) {
    return supabaseInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not found. Running in offline mode.')
    return null
  }

  // Create and cache the instance
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  console.log('✅ Supabase client instance created')
  return supabaseInstance
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