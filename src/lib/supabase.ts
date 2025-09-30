import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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