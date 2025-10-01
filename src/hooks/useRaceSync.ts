import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Horse, RaceState } from '@/types/horse';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RaceStateRow {
  id: string;
  race_state: RaceState;
  horses: Horse[];
  race_progress: Record<string, any>;
  pre_race_timer: number;
  countdown_timer?: number;
  race_timer?: number;
  race_start_time?: string;
  race_results: any[];
  show_photo_finish?: boolean;
  show_results?: boolean;
  photo_finish_results?: any[];
  weather_conditions?: any;
  created_at: string;
  updated_at: string;
  timer_owner?: string;
}

type SyncedRaceData = Omit<RaceStateRow, 'id' | 'created_at' | 'updated_at'>;

export function useRaceSync() {
  const [syncedData, setSyncedData] = useState<SyncedRaceData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const hasStartedServer = useRef(false);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Set connection status based on Supabase availability
  useEffect(() => {
    if (supabase) {
      setIsConnected(true);
    } else {
      setIsConnected(false);
      console.log('🏇 Supabase not available - running in offline mode');
    }
  }, []);

  // Start the autonomous race server when component mounts
  useEffect(() => {
    const startRaceServer = async () => {
      if (!supabase || hasStartedServer.current) return;
      
      try {
        console.log('🚀 Starting autonomous race server...');
        hasStartedServer.current = true;
        
        const { data, error } = await supabase.functions.invoke('supabase-functions-race-server', {
          body: {},
        });

        if (error) {
          console.error('❌ Failed to start race server:', error);
        } else {
          console.log('✅ Race server started:', data);
        }
      } catch (error) {
        console.error('❌ Error starting race server:', error);
      }
    };

    startRaceServer();
  }, []);

  // Polling function to constantly fetch latest race state
  const pollRaceState = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('race_state')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error polling race state:', error);
        return;
      }

      if (data) {
        setSyncedData(data as SyncedRaceData);
      }
    } catch (error) {
      console.error('Error in pollRaceState:', error);
    }
  }, []);

  // Load initial race state and start polling for real-time sync
  useEffect(() => {
    const loadRaceState = async () => {
      if (!supabase) return;

      try {
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
          console.log('🏇 No existing race state found - server will create one');
        }
      } catch (error) {
        console.error('Error in loadRaceState:', error);
      }
    };

    loadRaceState();

    // Balanced polling: 150ms for smooth race track updates without overwhelming the server
    console.log('🔄 Starting balanced polling every 150ms for smooth race updates...');
    pollingInterval.current = setInterval(pollRaceState, 150);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
  }, [pollRaceState]);

  // Subscribe to real-time updates (backup to polling)
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
              console.log('📡 Real-time update received:', payload);
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

  // These functions are now no-ops since the server handles everything
  const updateRaceState = useCallback(async (updates: Partial<SyncedRaceData>) => {
    console.log('🚫 Client cannot update race state - server is autonomous');
  }, []);

  const initializeNewRace = useCallback(async (horses: Horse[]) => {
    console.log('🚫 Client cannot initialize race - server handles this automatically');
  }, []);

  return {
    syncedData,
    isConnected,
    updateRaceState,
    initializeNewRace,
  };
}