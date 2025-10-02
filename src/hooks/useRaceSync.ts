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

  // Ultra-high-frequency client updates (120fps for maximum smoothness)
  useEffect(() => {
    if (!raceData || raceData.race_state !== 'racing') return;

    const clientUpdateInterval = setInterval(() => {
      setSmoothHorses(prev => 
        prev.map(horse => {
          if (!horse.lastServerUpdate) return horse;
          
          const now = Date.now();
          const timeSinceUpdate = now - horse.lastServerUpdate;
          
          // Ultra-smooth client prediction (max 200ms)
          if (timeSinceUpdate < 200 && horse.velocity > 0) {
            const deltaSeconds = timeSinceUpdate / 1000;
            const predictedPosition = Math.min(1200, horse.clientPosition + (horse.velocity * deltaSeconds));
            
            return {
              ...horse,
              clientPosition: predictedPosition
            };
          }
          
          return horse;
        })
      );
    }, 8); // 8ms = 120fps client updates for buttery-smooth movement

    return () => clearInterval(clientUpdateInterval);
  }, [raceData?.race_state]);

  // REAL-TIME VISUAL UPDATE LOOP - Independent of database subscription
  useEffect(() => {
    if (!raceData || raceData.race_state !== 'racing') return;

    const visualUpdateLoop = () => {
      const now = Date.now();
      const timeSinceServerUpdate = now - lastServerUpdate.current;
      
      // Update smooth horses with ultra-high frequency prediction
      setSmoothHorses(prevHorses => 
        prevHorses.map(horse => {
          if (!horse.velocity || horse.velocity <= 0) return horse;
          
          // Ultra-smooth client prediction (16ms updates = 60fps visual)
          const deltaTime = 16 / 1000; // 16ms in seconds
          const predictedPosition = Math.min(1200, horse.clientPosition + (horse.velocity * deltaTime));
          
          return {
            ...horse,
            clientPosition: predictedPosition,
            position: predictedPosition // Override for components
          };
        })
      );
      
      // Continue the loop at 60fps
      animationFrameRef.current = requestAnimationFrame(visualUpdateLoop);
    };

    // Start the visual update loop
    visualUpdateLoop();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [raceData?.race_state]);

  // Multiplayer-style client prediction system - ONLY for server sync
  useEffect(() => {
    if (!raceData) return;

    // This now only handles server updates, not visual updates
    const now = Date.now();
    const timeSinceLastUpdate = now - lastServerUpdate.current;
    
    if (raceData.race_state === 'racing' && raceData.horses) {
      const syncedHorses = raceData.horses.map((horse: any, index: number) => {
        if (!horse || typeof horse.position !== 'number') {
          return {
            ...horse,
            serverPosition: 0,
            clientPosition: 0,
            velocity: 0,
            lastServerUpdate: now,
            predictedPosition: 0
          };
        }

        // Find existing smooth horse or create new one
        const existingHorse = smoothHorses.find(h => h.id === horse.id);
        
        // Get server velocity if available, otherwise calculate realistic velocity
        let velocity = horse.velocity;
        if (!velocity) {
          // Calculate realistic velocity matching server logic (18-23 m/s range)
          const baseSpeed = ((horse.speed || 50) * 0.8 + (horse.acceleration || 50) * 0.2) / 100.0;
          const realisticSpeed = 18.0 + (baseSpeed * 5.0); // Range: 18-23 m/s
          const speedVariation = 0.85 + (Math.sin(now * 0.0003 + index) * 0.15);
          velocity = realisticSpeed * speedVariation;
        }
        
        let clientPosition;
        let predictedPosition;
        
        if (existingHorse && timeSinceLastUpdate < 300) { // 300ms max prediction for ultra-fast updates
          // Ultra-aggressive client-side prediction for buttery-smooth racing
          const deltaTime = timeSinceLastUpdate / 1000; // Convert to seconds
          predictedPosition = existingHorse.clientPosition + (velocity * deltaTime);
          
          // Ultra-fast correction towards server position (maximum responsiveness)
          const correctionStrength = Math.min(timeSinceLastUpdate / 50, 0.9); // Max 90% correction, ultra-fast blending
          clientPosition = predictedPosition * (1 - correctionStrength) + horse.position * correctionStrength;
        } else {
          // First update or too much lag - snap to server position
          clientPosition = horse.position;
          predictedPosition = horse.position;
        }
        
        // Ensure position doesn't exceed race distance
        clientPosition = Math.min(clientPosition, 1200);
        predictedPosition = Math.min(predictedPosition, 1200);
        
        return {
          ...horse,
          serverPosition: horse.position,
          clientPosition: clientPosition,
          velocity: velocity,
          lastServerUpdate: now,
          predictedPosition: predictedPosition,
          position: clientPosition // Override for components
        };
      });
      
      setSmoothHorses(syncedHorses);
    } else {
      // Not racing - use server positions directly
      const staticHorses = (raceData.horses || []).map((horse: any) => ({
        ...horse,
        serverPosition: horse.position || 0,
        clientPosition: horse.position || 0,
        velocity: 0,
        lastServerUpdate: now,
        predictedPosition: horse.position || 0
      }));
      setSmoothHorses(staticHorses);
    }
  }, [raceData, lastServerUpdate.current]);

  // Ultra-high-frequency server timer (60fps = 16ms for buttery-smooth racing)
  useEffect(() => {
    if (!supabase || !isConnected) return;

    console.log('⚡ Starting ultra-high-frequency race timer (60fps)...');
    
    timerInterval.current = setInterval(async () => {
      try {
        // Call high-frequency database function
        if (supabase) {
          const { error } = await supabase.rpc('update_race_state_high_frequency');
          
          if (error) {
            console.error('❌ High-frequency update error:', error);
          }
        }
      } catch (error) {
        console.error('❌ Timer error:', error);
      }
    }, 16); // 16ms = 60fps server updates (buttery-smooth racing)

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [isConnected]);

  // Helper functions for components
  const getCurrentHorses = useCallback(() => {
    // ALWAYS return smooth horses with client prediction during racing
    if (raceData?.race_state === 'racing' && smoothHorses.length > 0) {
      console.log('🏇 Returning smooth horses for racing:', smoothHorses.length);
      return smoothHorses;
    }
    
    // Return regular horses for non-racing states
    const regularHorses = raceData?.horses || [];
    console.log('🏇 Returning regular horses for non-racing:', regularHorses.length);
    return regularHorses;
  }, [smoothHorses, raceData]);

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
    const serverWeather = raceData?.weather_conditions;
    
    // Handle different weather formats from server
    if (serverWeather && typeof serverWeather === 'object') {
      // Check if it's the new server format with condition, humidity, temperature, windSpeed
      if ('condition' in serverWeather && 'humidity' in serverWeather) {
        console.log('🌤️ Converting server weather format:', serverWeather);
        
        // Convert server weather format to client format
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
        console.log('✅ Using existing client weather format:', serverWeather);
        return serverWeather as any;
      }
    }
    
    // Fallback to default conditions
    console.log('⚠️ Using default weather conditions');
    return {
      timeOfDay: "day" as const,
      weather: "clear" as const,
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