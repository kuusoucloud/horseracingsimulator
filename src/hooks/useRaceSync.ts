import { useEffect, useState, useCallback } from 'react'
import { supabase, type SyncedRaceData, type RaceState } from '@/lib/supabase'
import type { Horse } from '@/types/horse'

export function useRaceSync() {
  const [syncedData, setSyncedData] = useState<SyncedRaceData | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Subscribe to real-time updates
  useEffect(() => {
    let subscription: any

    const setupSubscription = async () => {
      // Get initial data
      const { data: initialData } = await supabase
        .from('race_state')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (initialData) {
        setSyncedData(initialData)
        setIsConnected(true)
      }

      // Subscribe to changes
      subscription = supabase
        .channel('race_state_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'race_state'
          },
          (payload) => {
            if (payload.new) {
              setSyncedData(payload.new as SyncedRaceData)
            }
          }
        )
        .subscribe()
    }

    setupSubscription()

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  // Update race state in database
  const updateRaceState = useCallback(async (updates: Partial<SyncedRaceData>) => {
    if (!syncedData) return

    const { error } = await supabase
      .from('race_state')
      .update(updates)
      .eq('id', syncedData.id)

    if (error) {
      console.error('Error updating race state:', error)
    }
  }, [syncedData])

  // Initialize new race
  const initializeNewRace = useCallback(async (horses: Horse[]) => {
    const { error } = await supabase
      .from('race_state')
      .update({
        race_state: 'pre-race',
        horses: horses,
        race_progress: {},
        pre_race_timer: 10,
        race_results: []
      })
      .eq('id', syncedData?.id)

    if (error) {
      console.error('Error initializing new race:', error)
    }
  }, [syncedData])

  return {
    syncedData,
    isConnected,
    updateRaceState,
    initializeNewRace
  }
}