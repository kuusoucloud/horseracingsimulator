import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Horse, RaceState } from '@/types/horse';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RaceStateRow {
  id: string;
  race_state: RaceState;
  horses: Horse[];
  race_progress: Record<string, number>;
  pre_race_timer: number;
  race_results: Horse[];
  created_at: string;
  updated_at: string;
  timer_owner?: string; // Add timer owner field
}

// Define the type for synced race data updates
type SyncedRaceData = Omit<RaceStateRow, 'id' | 'created_at' | 'updated_at'>;

export function useRaceSync() {
  const [syncedData, setSyncedData] = useState<SyncedRaceData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const clientId = useRef(Math.random().toString(36).substring(7));
  const isTimerOwner = useRef(false);

  // Set connection status based on Supabase availability
  useEffect(() => {
    if (supabase) {
      setIsConnected(true);
    } else {
      setIsConnected(false);
      console.log('🏇 Supabase not available - running in offline mode');
    }
  }, []);

  // Fetch current race state
  const fetchRaceState = useCallback(async () => {
    if (!supabase) {
      console.warn('Supabase client not available');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('race_state')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching race state:', error);
        return;
      }

      if (data) {
        setSyncedData(data as SyncedRaceData);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error fetching race state:', error);
    }
  }, []);

  // Update race state in database
  const updateRaceState = useCallback(async (updates: Partial<SyncedRaceData>) => {
    if (!supabase) {
      console.warn('Supabase client not available');
      return;
    }

    try {
      const { error } = await supabase
        .from('race_state')
        .update(updates)
        .eq('id', (await supabase.from('race_state').select('id').single()).data?.id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error updating race state:', error);
    }
  }, []);

  // Initialize new race function
  const initializeNewRace = useCallback(async (horses: Horse[]) => {
    if (!supabase) {
      console.warn('Supabase client not available');
      return;
    }

    try {
      // Delete existing race state
      await supabase.from('race_state').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Create new race state
      const { error } = await supabase
        .from('race_state')
        .insert({
          race_state: 'pre-race',
          horses: horses,
          race_progress: {},
          pre_race_timer: 10,
          race_results: [],
          timer_owner: null
        });
      
      if (error) throw error;
      
      // Update local state
      setSyncedData({
        race_state: 'pre-race',
        horses: horses,
        race_progress: {},
        pre_race_timer: 10,
        race_results: [],
        timer_owner: null
      });
      
    } catch (error) {
      console.error('Error initializing new race:', error);
    }
  }, [updateRaceState]);

  // Claim timer ownership
  const claimTimerOwnership = useCallback(async () => {
    if (!supabase) {
      console.warn('Supabase client not available');
      return false;
    }

    try {
      // First, get current race state to check timer ownership
      const { data, error } = await supabase
        .from('race_state')
        .select('timer_owner')
        .single();

      if (error) {
        console.error('Error checking timer ownership:', error);
        return false;
      }

      // If no owner or owner is stale, claim ownership
      if (!data?.timer_owner) {
        await updateRaceState({ timer_owner: clientId.current });
        isTimerOwner.current = true;
        return true;
      }
      
      return data.timer_owner === clientId.current;
    } catch (error) {
      console.error('Error claiming timer ownership:', error);
      return false;
    }
  }, [updateRaceState]);

  // Release timer ownership
  const releaseTimerOwnership = useCallback(async () => {
    if (!supabase) {
      console.warn('Supabase client not available');
      return;
    }

    if (isTimerOwner.current) {
      await updateRaceState({ timer_owner: undefined });
      isTimerOwner.current = false;
    }
  }, [updateRaceState]);

  // Subscribe to real-time updates
  useEffect(() => {
    let subscription: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      if (!supabase) {
        console.warn('Supabase client not available');
        return;
      }

      try {
        // Get initial data
        const { data: initialData } = await supabase
          .from('race_state')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (initialData) {
          setSyncedData(initialData as SyncedRaceData);
          setIsConnected(true);
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
                const newData = payload.new as RaceStateRow;
                setSyncedData(newData as SyncedRaceData);
              }
            }
          )
          .subscribe()
      } catch (error) {
        console.error('Error setting up subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Timer management - only for timer owner
  useEffect(() => {
    let preRaceInterval: NodeJS.Timeout;
    
    const manageTimer = async () => {
      if (syncedData?.race_state === 'pre-race' && syncedData?.horses?.length > 0) {
        // Try to claim timer ownership
        const hasOwnership = await claimTimerOwnership();
        
        if (hasOwnership && syncedData?.pre_race_timer > 0) {
          preRaceInterval = setTimeout(() => {
            updateRaceState({ pre_race_timer: syncedData.pre_race_timer - 1 });
          }, 1000);
        } else if (hasOwnership && syncedData?.pre_race_timer === 0) {
          updateRaceState({ race_state: 'countdown' });
        }
      }
    };

    manageTimer();
    
    return () => {
      if (preRaceInterval) {
        clearTimeout(preRaceInterval);
      }
    };
  }, [syncedData, claimTimerOwnership, updateRaceState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseTimerOwnership();
    };
  }, [releaseTimerOwnership]);

  return {
    syncedData,
    isConnected,
    updateRaceState,
    initializeNewRace,
  };
}