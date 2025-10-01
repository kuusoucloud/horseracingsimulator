import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Horse } from '@/types/horse';
import { generateRandomHorses } from '@/data/horses';
import { Database } from '@/types/supabase';

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

export type RaceState = 'pre-race' | 'countdown' | 'racing' | 'finished';

// Generate random horses client-side as fallback
function generateRandomHorses(count: number = 8): Horse[] {
  const names = [
    "Thunder Bolt", "Lightning Strike", "Storm Chaser", "Wind Runner",
    "Fire Spirit", "Golden Arrow", "Silver Bullet", "Midnight Express",
    "Desert Storm", "Ocean Wave", "Mountain Peak", "Forest Fire"
  ];
  
  const colors = ["#8B4513", "#654321", "#D2691E", "#A0522D", "#F4A460", "#DEB887"];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `horse-${i + 1}`,
    name: names[i] || `Horse ${i + 1}`,
    color: colors[i % colors.length],
    position: 0,
    speed: Math.random() * 0.5 + 0.5,
    stamina: Math.random() * 0.5 + 0.5,
    acceleration: Math.random() * 0.5 + 0.5,
    elo: Math.floor(Math.random() * 400) + 1200,
    odds: Math.random() * 8 + 2,
    lane: i + 1,
    finishTime: null,
    placement: null
  }));
}

export function useRaceSync() {
  const [syncedData, setSyncedData] = useState<SyncedRaceData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [clientHorses, setClientHorses] = useState<Horse[]>([]);
  const hasStartedServer = useRef(false);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const lastRaceId = useRef<string | null>(null);

  // Set connection status based on Supabase availability
  useEffect(() => {
    if (supabase) {
      setIsConnected(true);
    } else {
      setIsConnected(false);
      console.log('🏇 Supabase not available - running in offline mode');
    }
  }, []);

  // Start the race server - try edge function first, fallback to client-side
  useEffect(() => {
    const startRaceServer = async () => {
      if (!supabase || hasStartedServer.current) return;
      
      try {
        console.log('🚀 Starting race server...');
        hasStartedServer.current = true;
        
        // Try the correct function name - use the full slug
        const { data, error } = await supabase.functions.invoke('supabase-functions-race-server', {
          body: {},
        });

        if (error) {
          console.error('❌ Edge function failed, starting client-side race:', error);
          // Fallback: Create race state directly in database
          await createClientSideRace();
        } else {
          console.log('✅ Race server started:', data);
        }
      } catch (error) {
        console.error('❌ Error starting race server, falling back to client-side:', error);
        await createClientSideRace();
      }
    };

    const createClientSideRace = async () => {
      if (!supabase) {
        console.log('❌ Supabase not available - cannot create client-side race');
        return;
      }
      
      try {
        console.log('🏇 Creating client-side race...');
        
        // Generate horses client-side
        const newHorses = generateRandomHorses(8);
        setClientHorses(newHorses);
        
        // Create race state in database
        const raceData: Database['public']['Tables']['race_state']['Insert'] = {
          race_state: 'pre-race',
          horses: newHorses,
          race_progress: {},
          pre_race_timer: 10,
          countdown_timer: 0,
          race_timer: 0,
          race_start_time: null,
          race_results: [],
          show_photo_finish: false,
          show_results: false,
          photo_finish_results: [],
          weather_conditions: {
            timeOfDay: "day",
            weather: "clear",
            skyColor: "#87ceeb",
            ambientIntensity: 0.4,
            directionalIntensity: 1.0,
            trackColor: "#8B4513",
            grassColor: "#32cd32"
          },
          timer_owner: 'client'
        };

        // Clear any existing race
        await supabase.from('race_state').delete().neq('id', '');
        
        // Insert new race
        const { error: insertError } = await supabase
          .from('race_state')
          .insert([raceData]);

        if (insertError) {
          console.error('❌ Error creating client-side race:', insertError);
        } else {
          console.log('✅ Client-side race created successfully');
        }
      } catch (error) {
        console.error('❌ Error in createClientSideRace:', error);
      }
    };

    startRaceServer();
  }, []);

  // Timer function - now calls race-timer with correct name
  const callRaceTimer = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase.functions.invoke('supabase-functions-race-timer', {
        body: {},
      });

      if (error) {
        console.error('❌ Race timer error:', error);
      } else {
        console.log('⏰ Timer tick:', data?.message || 'Timer updated');
      }
    } catch (error) {
      console.error('❌ Error calling race timer:', error);
    }
  }, []);

  // Enhanced polling function with client-side horse caching
  const pollRaceState = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('race_state')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // Use maybeSingle instead of single to handle empty results

      if (error) {
        console.error('Error polling race state:', error);
        return;
      }

      if (data) {
        const raceData = data as SyncedRaceData;
        
        // Check if this is a new race (different horses or new race cycle)
        const currentRaceId = raceData.horses?.map(h => h.id).join('-') || '';
        const isNewRace = currentRaceId !== lastRaceId.current;
        
        if (isNewRace && raceData.horses && raceData.horses.length > 0) {
          console.log('🏇 New race detected - updating client horse cache');
          setClientHorses([...raceData.horses]); // Cache horses on client
          lastRaceId.current = currentRaceId;
        }
        
        // Use cached horses if server horses are missing or empty
        const finalRaceData = {
          ...raceData,
          horses: raceData.horses && raceData.horses.length > 0 ? raceData.horses : clientHorses
        };
        
        setSyncedData(finalRaceData);
      } else {
        console.log('🏇 No race state found in database');
      }
    } catch (error) {
      console.error('Error in pollRaceState:', error);
    }
  }, [clientHorses]);

  // Load initial race state and start polling for real-time sync
  useEffect(() => {
    const loadRaceState = async () => {
      if (!supabase) return;

      try {
        const { data, error } = await supabase
          .from('race_state')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error loading race state:', error);
          return;
        }

        if (data) {
          console.log('🏇 Loaded existing race state:', data);
          const raceData = data as SyncedRaceData;
          
          if (raceData.horses && raceData.horses.length > 0) {
            setClientHorses([...raceData.horses]);
            lastRaceId.current = raceData.horses.map(h => h.id).join('-');
          }
          
          setSyncedData(raceData);
        } else {
          console.log('🏇 No existing race state found - server will create one');
        }
      } catch (error) {
        console.error('Error in loadRaceState:', error);
      }
    };

    loadRaceState();

    // Start the race timer - calls race-timer function every second
    console.log('⏰ Starting race timer - calling race-timer function every 1000ms');
    timerInterval.current = setInterval(callRaceTimer, 1000);

    // Slower polling for UI components: 300ms for smooth updates without overwhelming
    console.log('🔄 Starting balanced polling every 300ms for smooth updates...');
    pollingInterval.current = setInterval(pollRaceState, 300);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    };
  }, [pollRaceState, callRaceTimer]);

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
                const raceData = payload.new as SyncedRaceData;
                
                if (raceData.horses && raceData.horses.length > 0) {
                  const currentRaceId = raceData.horses.map(h => h.id).join('-');
                  if (currentRaceId !== lastRaceId.current) {
                    console.log('📡 Real-time: New race detected - updating client horse cache');
                    setClientHorses([...raceData.horses]);
                    lastRaceId.current = currentRaceId;
                  }
                }
                
                const finalRaceData = {
                  ...raceData,
                  horses: raceData.horses && raceData.horses.length > 0 ? raceData.horses : clientHorses
                };
                
                setSyncedData(finalRaceData);
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
  }, [clientHorses]);

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