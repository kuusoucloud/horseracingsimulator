import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Horse } from '@/types/horse';

export type RaceState = 'pre-race' | 'countdown' | 'racing' | 'finished';

interface RaceData {
  id?: string;
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
  timer_owner?: string;
}

interface InterpolatedHorse extends Horse {
  serverPosition: number;
  clientPosition: number;
  velocity: number;
  lastUpdateTime: number;
}

export function useRaceSync() {
  const [raceData, setRaceData] = useState<RaceData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Smooth interpolation system
  const [interpolatedHorses, setInterpolatedHorses] = useState<InterpolatedHorse[]>([]);
  const lastServerUpdate = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const subscription = useRef<any>(null);

  // Initialize and load current race state
  useEffect(() => {
    if (!supabase) {
      console.log('🏇 No Supabase connection - running offline');
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    const initializeRaceSystem = async () => {
      try {
        console.log('🏇 Loading current race state...');

        // Load current race state
        if (supabase) {
          const { data: currentRace, error } = await supabase
            .from('race_state')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error('❌ Error loading race:', error);
          } else if (currentRace) {
            console.log('🏇 Loaded race:', currentRace.race_state);
            // Type-safe conversion from database row to RaceData
            const raceDataFromDB: RaceData = {
              id: currentRace.id,
              race_state: currentRace.race_state as RaceState,
              horses: (currentRace.horses as any) || [],
              race_progress: (currentRace.race_progress as any) || {},
              pre_race_timer: currentRace.pre_race_timer || 0,
              countdown_timer: currentRace.countdown_timer || undefined,
              race_timer: currentRace.race_timer || undefined,
              race_start_time: currentRace.race_start_time || undefined,
              race_results: (currentRace.race_results as any) || [],
              show_photo_finish: currentRace.show_photo_finish || false,
              show_results: currentRace.show_results || false,
              photo_finish_results: (currentRace.photo_finish_results as any) || [],
              weather_conditions: (currentRace.weather_conditions as any) || undefined,
              timer_owner: currentRace.timer_owner || undefined,
            };
            setRaceData(raceDataFromDB);
            lastServerUpdate.current = Date.now();
          } else {
            console.log('🏇 No race found, database will create one on first tick');
          }
        }

        setIsConnected(true);
        setIsLoading(false);

      } catch (error) {
        console.error('❌ Error initializing race system:', error);
        setIsConnected(false);
        setIsLoading(false);
      }
    };

    initializeRaceSystem();
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    if (!supabase || !isConnected) return;

    console.log('📡 Setting up real-time subscription...');
    
    subscription.current = supabase
      .channel('race_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'race_state'
        },
        (payload) => {
          console.log('📡 Race update received:', payload.eventType);
          if (payload.new) {
            // Type-safe conversion for real-time updates
            const dbRow = payload.new as any;
            const raceDataFromDB: RaceData = {
              id: dbRow.id,
              race_state: dbRow.race_state as RaceState,
              horses: dbRow.horses || [],
              race_progress: dbRow.race_progress || {},
              pre_race_timer: dbRow.pre_race_timer || 0,
              countdown_timer: dbRow.countdown_timer || undefined,
              race_timer: dbRow.race_timer || undefined,
              race_start_time: dbRow.race_start_time || undefined,
              race_results: dbRow.race_results || [],
              show_photo_finish: dbRow.show_photo_finish || false,
              show_results: dbRow.show_results || false,
              photo_finish_results: dbRow.photo_finish_results || [],
              weather_conditions: dbRow.weather_conditions || undefined,
              timer_owner: dbRow.timer_owner || undefined,
            };
            setRaceData(raceDataFromDB);
            lastServerUpdate.current = Date.now();
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      if (subscription.current) {
        subscription.current.unsubscribe();
      }
    };
  }, [isConnected]);

  // Smooth interpolation system using requestAnimationFrame
  useEffect(() => {
    if (!raceData) return;

    const updateInterpolatedPositions = () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastServerUpdate.current;
      
      if (raceData.race_state === 'racing' && raceData.horses) {
        const smoothHorses = raceData.horses.map((horse: any, index: number) => {
          if (!horse || typeof horse.position !== 'number') {
            return {
              ...horse,
              serverPosition: 0,
              clientPosition: 0,
              velocity: 0,
              lastUpdateTime: now
            };
          }

          // Find existing interpolated horse or create new one
          const existingHorse = interpolatedHorses.find(h => h.id === horse.id);
          
          // Calculate horse's expected speed based on attributes
          const baseSpeed = (horse.speed || 50) * 0.8 + (horse.acceleration || 50) * 0.2;
          const speedVariation = 0.85 + (Math.sin(now * 0.001 + index) * 0.15); // Smooth variation
          const currentSpeed = baseSpeed * speedVariation;
          
          // Convert speed to meters per second (more realistic)
          const metersPerSecond = currentSpeed * 0.6; // Adjust for realistic horse speeds
          
          let clientPosition;
          let velocity = metersPerSecond;
          
          if (existingHorse && timeSinceLastUpdate < 2000) {
            // Smooth interpolation from last known position
            const deltaTime = timeSinceLastUpdate / 1000; // Convert to seconds
            const predictedPosition = existingHorse.clientPosition + (velocity * deltaTime);
            
            // Blend server position with predicted position for smooth correction
            const serverWeight = Math.min(timeSinceLastUpdate / 1000, 0.3); // Max 30% server influence
            clientPosition = predictedPosition * (1 - serverWeight) + horse.position * serverWeight;
          } else {
            // First update or too much time passed - use server position
            clientPosition = horse.position;
          }
          
          // Ensure position doesn't exceed race distance
          clientPosition = Math.min(clientPosition, 1200);
          
          return {
            ...horse,
            serverPosition: horse.position,
            clientPosition: clientPosition,
            velocity: velocity,
            lastUpdateTime: now,
            position: clientPosition // Override position for components
          };
        });
        
        setInterpolatedHorses(smoothHorses);
      } else {
        // Not racing - use server positions directly
        const staticHorses = (raceData.horses || []).map((horse: any) => ({
          ...horse,
          serverPosition: horse.position || 0,
          clientPosition: horse.position || 0,
          velocity: 0,
          lastUpdateTime: now
        }));
        setInterpolatedHorses(staticHorses);
      }
      
      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(updateInterpolatedPositions);
    };

    // Start animation loop
    updateInterpolatedPositions();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [raceData, lastServerUpdate.current]);

  // Server timer that calls database function (keep at 1 second for sync)
  useEffect(() => {
    if (!supabase || !isConnected) return;

    console.log('⏰ Starting database-driven race timer...');
    
    timerInterval.current = setInterval(async () => {
      try {
        // Call database function directly - no edge function needed!
        if (supabase) {
          const { error } = await supabase.rpc('trigger_race_tick');
          
          if (error) {
            console.error('❌ Database tick error:', error);
          }
        }
      } catch (error) {
        console.error('❌ Timer error:', error);
      }
    }, 1000); // Keep server updates at 1 second for synchronization

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [isConnected]);

  // Helper functions for components
  const getCurrentHorses = useCallback(() => {
    // Always return interpolated horses for smooth movement
    return interpolatedHorses.length > 0 ? interpolatedHorses : (raceData?.horses || []);
  }, [interpolatedHorses, raceData]);

  const getRaceState = useCallback(() => {
    return raceData?.race_state || 'pre-race';
  }, [raceData]);

  const getTimer = useCallback(() => {
    if (!raceData) return 0;
    
    switch (raceData.race_state) {
      case 'pre-race':
        return raceData.pre_race_timer || 0;
      case 'countdown':
        return raceData.countdown_timer || 0;
      case 'racing':
        return raceData.race_timer || 0;
      default:
        return 0;
    }
  }, [raceData]);

  const getRaceResults = useCallback(() => {
    return raceData?.race_results || [];
  }, [raceData]);

  const getWeatherConditions = useCallback(() => {
    return raceData?.weather_conditions || {
      timeOfDay: "day",
      weather: "clear",
      skyColor: "#87ceeb",
      ambientIntensity: 0.4,
      directionalIntensity: 1.0,
      trackColor: "#8B4513",
      grassColor: "#32cd32"
    };
  }, [raceData]);

  const shouldShowPhotoFinish = useCallback(() => {
    return raceData?.show_photo_finish || false;
  }, [raceData]);

  const shouldShowResults = useCallback(() => {
    return raceData?.show_results || false;
  }, [raceData]);

  const getPhotoFinishResults = useCallback(() => {
    return raceData?.photo_finish_results || [];
  }, [raceData]);

  return {
    // Core state
    raceData,
    isConnected,
    isLoading,
    
    // Helper functions
    getCurrentHorses,
    getRaceState,
    getTimer,
    getRaceResults,
    getWeatherConditions,
    shouldShowPhotoFinish,
    shouldShowResults,
    getPhotoFinishResults,
    
    // Legacy compatibility (for existing components)
    syncedData: raceData,
    updateRaceState: () => console.log('🚫 Client is read-only'),
    initializeNewRace: () => console.log('🚫 Database handles race creation'),
  };
}