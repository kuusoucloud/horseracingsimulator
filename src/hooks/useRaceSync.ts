import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Horse, RaceState } from '@/types/horse';

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

export function useRaceSync() {
  const [raceState, setRaceState] = useState<RaceState>('pre-race');
  const [horses, setHorses] = useState<Horse[]>([]);
  const [raceProgress, setRaceProgress] = useState<Record<string, number>>({});
  const [preRaceTimer, setPreRaceTimer] = useState(10);
  const [raceResults, setRaceResults] = useState<Horse[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const clientId = useRef(Math.random().toString(36).substring(7));
  const isTimerOwner = useRef(false);

  // Fetch current race state
  const fetchRaceState = useCallback(async () => {
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
        setRaceState(data.race_state);
        setHorses(data.horses || []);
        setRaceProgress(data.race_progress || {});
        setPreRaceTimer(data.pre_race_timer || 10);
        setRaceResults(data.race_results || []);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error fetching race state:', error);
    }
  }, []);

  // Update race state in database
  const updateRaceState = useCallback(async (updates: Partial<RaceStateRow>) => {
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
  const initializeNewRace = useCallback(async (newHorses: Horse[]) => {
    try {
      // Delete existing race state
      await supabase.from('race_state').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Create new race state
      const { error } = await supabase
        .from('race_state')
        .insert({
          race_state: 'pre-race',
          horses: newHorses,
          race_progress: {},
          pre_race_timer: 10,
          race_results: [],
          timer_owner: null
        });
      
      if (error) throw error;
      
      // Update local state
      setRaceState('pre-race');
      setHorses(newHorses);
      setRaceProgress({});
      setPreRaceTimer(10);
      setRaceResults([]);
      
    } catch (error) {
      console.error('Error initializing new race:', error);
    }
  }, []);

  // Claim timer ownership
  const claimTimerOwnership = useCallback(async () => {
    try {
      const { data } = await supabase.from('race_state').select('timer_owner').single();
      
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
    if (isTimerOwner.current) {
      await updateRaceState({ timer_owner: null });
      isTimerOwner.current = false;
    }
  }, [updateRaceState]);

  // Subscribe to real-time updates
  useEffect(() => {
    let subscription: any;

    const setupSubscription = async () => {
      // Get initial data
      const { data: initialData } = await supabase
        .from('race_state')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (initialData) {
        setRaceState(initialData.race_state);
        setHorses(initialData.horses || []);
        setRaceProgress(initialData.race_progress || {});
        setPreRaceTimer(initialData.pre_race_timer || 10);
        setRaceResults(initialData.race_results || []);
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
              setRaceState(payload.new.race_state);
              setHorses(payload.new.horses || []);
              setRaceProgress(payload.new.race_progress || {});
              setPreRaceTimer(payload.new.pre_race_timer || 10);
              setRaceResults(payload.new.race_results || []);
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
  }, []);

  // Timer management - only for timer owner
  useEffect(() => {
    let preRaceInterval: NodeJS.Timeout;
    
    const manageTimer = async () => {
      if (raceState === 'pre-race' && horses.length > 0) {
        // Try to claim timer ownership
        const hasOwnership = await claimTimerOwnership();
        
        if (hasOwnership && preRaceTimer > 0) {
          preRaceInterval = setTimeout(() => {
            updateRaceState({ pre_race_timer: preRaceTimer - 1 });
          }, 1000);
        } else if (hasOwnership && preRaceTimer === 0) {
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
  }, [raceState, horses.length, preRaceTimer, updateRaceState, claimTimerOwnership]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseTimerOwnership();
    };
  }, [releaseTimerOwnership]);

  return {
    syncedData: {
      horses,
      race_state: raceState,
      race_progress: raceProgress,
      pre_race_timer: preRaceTimer,
      race_results: raceResults
    },
    raceState,
    horses,
    raceProgress,
    preRaceTimer,
    raceResults,
    isConnected,
    updateRaceState,
    initializeNewRace,
  };
}