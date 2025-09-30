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
  countdown_timer?: number; // Add countdown timer
  race_timer?: number; // Add race timer
  race_start_time?: string; // Add race start time
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

  // Load initial race state
  useEffect(() => {
    const loadRaceState = async () => {
      if (!supabase) return;

      try {
        // Try to get existing race state
        const { data, error } = await supabase
          .from('race_state')
          .select('*')
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading race state:', error);
          return;
        }

        if (data) {
          console.log('🏇 Loaded existing race state:', data);
          setSyncedData(data as SyncedRaceData);
        } else {
          console.log('🏇 No existing race state found');
        }
      } catch (error) {
        console.error('Error in loadRaceState:', error);
      }
    };

    loadRaceState();
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    let subscription: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      if (!supabase) {
        console.log('🏇 Supabase not available - running in offline mode');
        return;
      }

      try {
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
              console.log('���� Real-time update received:', payload);
              if (payload.new && typeof payload.new === 'object') {
                setSyncedData(payload.new as SyncedRaceData);
              }
            }
          )
          .subscribe((status) => {
            console.log('📡 Subscription status:', status);
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
            }
          });
      } catch (error) {
        console.error('Error setting up subscription:', error);
        setIsConnected(false);
      }
    };

    setupSubscription();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Update race state function with better error handling
  const updateRaceState = useCallback(async (updates: Partial<SyncedRaceData>) => {
    if (!supabase) {
      console.warn('Supabase client not available');
      return;
    }

    try {
      // First, get the current race state ID
      const { data: currentData, error: selectError } = await supabase
        .from('race_state')
        .select('id')
        .limit(1)
        .single();

      if (selectError) {
        console.error('Error getting current race state:', selectError);
        return;
      }

      if (!currentData?.id) {
        console.error('No race state found to update');
        return;
      }

      // Update the race state
      const { error: updateError } = await supabase
        .from('race_state')
        .update(updates)
        .eq('id', currentData.id);

      if (updateError) {
        console.error('Error updating race state:', updateError);
        return;
      }

      console.log('✅ Race state updated successfully:', updates);
    } catch (error) {
      console.error('Error updating race state:', error);
    }
  }, []);

  // Initialize new race function with better error handling
  const initializeNewRace = useCallback(async (horses: Horse[]) => {
    if (!supabase) {
      console.warn('Supabase client not available');
      return;
    }

    try {
      // Check if there's already an active race first
      const { data: existingRace, error: checkError } = await supabase
        .from('race_state')
        .select('*')
        .limit(1)
        .single();

      if (!checkError && existingRace && existingRace.horses && existingRace.horses.length > 0) {
        console.log('🏇 Race already exists, using existing race:', existingRace);
        setSyncedData(existingRace as SyncedRaceData);
        return;
      }

      // Delete all existing race states
      const { error: deleteError } = await supabase
        .from('race_state')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (deleteError) {
        console.error('Error deleting existing race states:', deleteError);
      }

      // Create new race state
      const newRaceState = {
        race_state: 'pre-race' as const,
        horses: horses,
        race_progress: {},
        pre_race_timer: 10,
        race_results: [],
        timer_owner: null as string | null
      };

      const { data, error: insertError } = await supabase
        .from('race_state')
        .insert(newRaceState)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating new race state:', insertError);
        return;
      }

      console.log('🏇 New race initialized successfully:', data);
      setSyncedData(data as SyncedRaceData);

    } catch (error) {
      console.error('Error initializing new race:', error);
    }
  }, []);

  // Timer ownership with better error handling - SIMPLIFIED since server handles timer
  const claimTimerOwnership = useCallback(async (): Promise<boolean> => {
    // Server now handles timer, so this is simplified
    return true;
  }, []);

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

  // Server-side timer management
  useEffect(() => {
    let timerInterval: NodeJS.Timeout;
    
    const startServerTimer = () => {
      if (!supabase || !syncedData) {
        console.log('🚫 Cannot start timer - missing supabase or syncedData:', { supabase: !!supabase, syncedData: !!syncedData });
        return;
      }
      
      // Start server timer for any active race state (pre-race, countdown, racing)
      if (syncedData.horses?.length > 0 && ['pre-race', 'countdown', 'racing'].includes(syncedData.race_state)) {
        console.log('🚀 Starting server-side timer management for state:', syncedData.race_state, 'horses:', syncedData.horses?.length);
        
        timerInterval = setInterval(async () => {
          try {
            console.log('📡 Calling server timer function...');
            // Call the server-side timer function with correct URL
            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/supabase-functions-race-timer`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              console.error('❌ Server timer request failed:', response.status, response.statusText);
              const errorText = await response.text();
              console.error('Error details:', errorText);
            } else {
              const result = await response.json();
              console.log('⏰ Server timer response:', result);
            }
          } catch (error) {
            console.error('❌ Error calling server timer:', error);
          }
        }, 1000); // Call server every second
      } else {
        console.log('🚫 Not starting timer - conditions not met:', {
          horsesLength: syncedData.horses?.length,
          raceState: syncedData.race_state,
          validStates: ['pre-race', 'countdown', 'racing'].includes(syncedData.race_state)
        });
      }
    };

    // Start the server timer
    startServerTimer();
    
    return () => {
      if (timerInterval) {
        console.log('🛑 Clearing timer interval');
        clearInterval(timerInterval);
      }
    };
  }, [syncedData?.race_state, syncedData?.horses?.length]);

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