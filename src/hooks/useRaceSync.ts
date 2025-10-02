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

interface SmoothHorse extends Horse {
  serverPosition: number;
  clientPosition: number;
  velocity: number;
  lastServerUpdate: number;
  predictedPosition: number;
}

export function useRaceSync() {
  const [raceData, setRaceData] = useState<RaceData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Multiplayer-style smooth horses with client prediction
  const [smoothHorses, setSmoothHorses] = useState<SmoothHorse[]>([]);
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

  // OPTIMIZED VISUAL UPDATE SYSTEM - Much more efficient
  useEffect(() => {
    if (!raceData || raceData.race_state !== 'racing') {
      // Cancel any running animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    console.log('🏇 Starting optimized visual updates...');
    let lastUpdateTime = Date.now();

    const optimizedVisualUpdate = () => {
      const now = Date.now();
      const deltaTime = (now - lastUpdateTime) / 1000; // Convert to seconds
      
      // Only update if enough time has passed (30fps instead of 60fps)
      if (deltaTime < 0.033) {
        animationFrameRef.current = requestAnimationFrame(optimizedVisualUpdate);
        return;
      }
      
      lastUpdateTime = now;

      setSmoothHorses(prevHorses => {
        if (prevHorses.length === 0) return prevHorses;
        
        let hasChanges = false;
        const updatedHorses = prevHorses.map(horse => {
          if (!horse.velocity || horse.velocity <= 0) return horse;
          
          // Calculate time since server update
          const timeSinceUpdate = now - horse.lastServerUpdate;
          const predictionTime = Math.min(timeSinceUpdate, 200) / 1000; // Max 200ms prediction
          
          // Predict where horse should be based on server position + velocity
          const predictedPosition = Math.min(1200, horse.serverPosition + (horse.velocity * predictionTime));
          const currentPosition = horse.position || 0;
          
          // Smooth interpolation towards predicted position
          const lerpFactor = Math.min(deltaTime * 12, 1); // Faster interpolation for responsiveness
          const newPosition = currentPosition + (predictedPosition - currentPosition) * lerpFactor;
          
          // Only update if position changed significantly (reduces unnecessary renders)
          if (Math.abs(newPosition - currentPosition) > 0.1) {
            hasChanges = true;
            return {
              ...horse,
              clientPosition: newPosition,
              position: newPosition
            };
          }
          
          return horse;
        });
        
        // Only return new array if there are actual changes
        return hasChanges ? updatedHorses : prevHorses;
      });
      
      // Continue the update loop
      animationFrameRef.current = requestAnimationFrame(optimizedVisualUpdate);
    };

    // Start the visual update loop
    optimizedVisualUpdate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [raceData?.race_state]);

  // OPTIMIZED server sync - handles position updates from database
  useEffect(() => {
    if (!raceData) return;

    const now = Date.now();
    
    if (raceData.race_state === 'racing' && raceData.horses) {
      console.log('🏇 Syncing server positions for', raceData.horses.length, 'horses');
      
      setSmoothHorses(prevHorses => {
        // If we don't have smooth horses yet, initialize them
        if (prevHorses.length === 0) {
          return raceData.horses.map((horse: any, index: number) => {
            if (!horse || typeof horse.position !== 'number') {
              return {
                ...horse,
                serverPosition: 0,
                clientPosition: 0,
                velocity: 0,
                lastServerUpdate: now,
                position: 0,
                predictedPosition: 0
              };
            }

            // Calculate consistent velocity for each horse
            const baseSpeed = ((horse.speed || 50) * 0.8 + (horse.acceleration || 50) * 0.2) / 100.0;
            const realisticSpeed = 18.0 + (baseSpeed * 5.0);
            // Use horse ID for consistent random seed
            const seedValue = horse.id ? parseInt(horse.id.slice(-4), 16) / 65536 : Math.random();
            const speedVariation = 0.85 + (seedValue * 0.3); // More consistent speed variation
            const velocity = realisticSpeed * speedVariation;
            
            return {
              ...horse,
              serverPosition: horse.position,
              clientPosition: horse.position,
              velocity: velocity,
              lastServerUpdate: now,
              position: horse.position,
              predictedPosition: horse.position
            };
          });
        }
        
        // Update existing smooth horses with new server data - GENTLE SYNC
        return prevHorses.map((smoothHorse, index) => {
          const serverHorse = raceData.horses[index];
          if (!serverHorse) return smoothHorse;
          
          // Check if server position has significantly changed (new server update)
          const serverPositionChanged = Math.abs((serverHorse.position || 0) - smoothHorse.serverPosition) > 1;
          
          if (serverPositionChanged) {
            // Server position updated - gently sync without jarring jumps
            const timeSinceLastUpdate = now - smoothHorse.lastServerUpdate;
            const currentClientPosition = smoothHorse.position || smoothHorse.clientPosition || 0;
            
            // If client is way ahead of server, gradually pull back
            const serverPos = serverHorse.position || 0;
            const positionDiff = currentClientPosition - serverPos;
            
            let newClientPosition = currentClientPosition;
            if (positionDiff > 50) {
              // Client is too far ahead, gradually sync back
              newClientPosition = serverPos + (positionDiff * 0.7);
            } else if (positionDiff < -20) {
              // Client is behind, catch up faster
              newClientPosition = serverPos;
            }
            
            return {
              ...smoothHorse,
              ...serverHorse, // Update horse data (name, stats, etc.)
              serverPosition: serverPos,
              velocity: (serverHorse as any).velocity || smoothHorse.velocity,
              lastServerUpdate: now,
              position: newClientPosition,
              clientPosition: newClientPosition,
              predictedPosition: newClientPosition
            };
          } else {
            // No server position change - just update metadata
            return {
              ...smoothHorse,
              ...serverHorse, // Update horse data but keep positions
              serverPosition: smoothHorse.serverPosition,
              velocity: (serverHorse as any).velocity || smoothHorse.velocity,
              position: smoothHorse.position,
              clientPosition: smoothHorse.clientPosition,
              predictedPosition: smoothHorse.predictedPosition
            };
          }
        });
      });
    } else {
      // Not racing - use server positions directly (no extra processing)
      const staticHorses = (raceData.horses || []).map((horse: any) => ({
        ...horse,
        serverPosition: horse.position || 0,
        clientPosition: horse.position || 0,
        velocity: 0,
        lastServerUpdate: now,
        position: horse.position || 0,
        predictedPosition: horse.position || 0
      }));
      setSmoothHorses(staticHorses);
    }
  }, [raceData]);

  // OPTIMIZED server timer - Reduced frequency for better performance
  useEffect(() => {
    if (!supabase || !isConnected) return;

    console.log('⚡ Starting optimized race timer (20fps)...');
    
    timerInterval.current = setInterval(async () => {
      try {
        // Call database function at reasonable frequency
        if (supabase) {
          const { error } = await supabase.rpc('update_race_state_high_frequency');
          
          if (error) {
            console.error('❌ Update error:', error);
          }
        }
      } catch (error) {
        console.error('❌ Timer error:', error);
      }
    }, 50); // 50ms = 20fps server updates (still smooth but much more efficient)

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [isConnected]);

  // OPTIMIZED helper functions for components
  const getCurrentHorses = useCallback(() => {
    // Return smooth horses during racing, regular horses otherwise
    if (raceData?.race_state === 'racing' && smoothHorses.length > 0) {
      return smoothHorses;
    }
    
    return raceData?.horses || [];
  }, [smoothHorses, raceData]);

  const getRaceState = useCallback(() => {
    return raceData?.race_state || 'pre-race';
  }, [raceData?.race_state]);

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
  }, [raceData?.race_state, raceData?.pre_race_timer, raceData?.countdown_timer, raceData?.race_timer]);

  const getRaceResults = useCallback(() => {
    return raceData?.race_results || [];
  }, [raceData?.race_results]);

  // OPTIMIZED weather conditions - cached result
  const getWeatherConditions = useCallback(() => {
    const serverWeather = raceData?.weather_conditions;
    
    // Handle different weather formats from server
    if (serverWeather && typeof serverWeather === 'object') {
      // Check if it's the new server format
      if ('condition' in serverWeather && 'humidity' in serverWeather) {
        const condition = serverWeather.condition as string;
        const isRainy = condition === 'rainy' || condition === 'rain';
        const isTwilight = condition === 'twilight' || condition === 'night';
        
        return {
          timeOfDay: isTwilight ? "night" as const : "day" as const,
          weather: isRainy ? "rain" as const : "clear" as const,
          skyColor: isTwilight 
            ? (isRainy ? "#4a4a6b" : "#6a5acd")
            : (isRainy ? "#6b7280" : "#87ceeb"),
          ambientIntensity: isTwilight ? 0.6 : 0.4,
          directionalIntensity: isRainy ? 0.7 : (isTwilight ? 0.8 : 1.0),
          trackColor: isRainy ? "#5d4e37" : "#8B4513",
          grassColor: isRainy ? "#2d5a2d" : (isTwilight ? "#228b22" : "#32cd32"),
        };
      }
      
      // Check if it's already in the correct client format
      if ('timeOfDay' in serverWeather && 'weather' in serverWeather) {
        return serverWeather as any;
      }
    }
    
    // Fallback to default conditions
    return {
      timeOfDay: "day" as const,
      weather: "clear" as const,
      skyColor: "#87ceeb",
      ambientIntensity: 0.4,
      directionalIntensity: 1.0,
      trackColor: "#8B4513",
      grassColor: "#32cd32"
    };
  }, [raceData?.weather_conditions]);

  const shouldShowPhotoFinish = useCallback(() => {
    return raceData?.show_photo_finish || false;
  }, [raceData?.show_photo_finish]);

  const shouldShowResults = useCallback(() => {
    return raceData?.show_results || false;
  }, [raceData?.show_results]);

  const getPhotoFinishResults = useCallback(() => {
    return raceData?.photo_finish_results || [];
  }, [raceData?.photo_finish_results]);

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