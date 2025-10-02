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
  const [isWaitingForNewRace, setIsWaitingForNewRace] = useState(false);
  
  // Use ref to track waiting state for subscription callback
  const isWaitingRef = useRef(false);
  const waitingStartTime = useRef<number>(0);
  
  // Multiplayer-style smooth horses with client prediction
  const [smoothHorses, setSmoothHorses] = useState<SmoothHorse[]>([]);
  const lastServerUpdate = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const subscription = useRef<any>(null);

  // Sync waiting state with ref
  useEffect(() => {
    isWaitingRef.current = isWaitingForNewRace;
    if (isWaitingForNewRace && waitingStartTime.current === 0) {
      waitingStartTime.current = Date.now();
    } else if (!isWaitingForNewRace) {
      waitingStartTime.current = 0;
    }
  }, [isWaitingForNewRace]);

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
            
            // CHECK: If connecting mid-race, block the client and wait for new race
            if (currentRace.race_state === 'racing' || currentRace.race_state === 'countdown') {
              console.log('🚫 Client connected mid-race - waiting for next race to start');
              setIsWaitingForNewRace(true);
              isWaitingRef.current = true;
              setRaceData(null); // Don't show the current race
            } else {
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
              setIsWaitingForNewRace(false);
              isWaitingRef.current = false;
            }
            lastServerUpdate.current = Date.now();
          } else {
            console.log('🏇 No race found, database will create one on first tick');
            setIsWaitingForNewRace(false);
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
            
            // HANDLE MID-RACE CONNECTION: Use ref to get current waiting state
            if (isWaitingRef.current) {
              // Check if we've been waiting too long (60 seconds) - auto-unlock
              const waitingDuration = Date.now() - waitingStartTime.current;
              const maxWaitTime = 60000; // 60 seconds
              
              if (waitingDuration > maxWaitTime) {
                console.log('⏰ Auto-unlocking client after 60 seconds of waiting');
                setIsWaitingForNewRace(false);
                isWaitingRef.current = false;
                setRaceData(raceDataFromDB);
              } else if (raceDataFromDB.race_state === 'pre-race' || raceDataFromDB.race_state === 'finished') {
                console.log('✅ New race started - client can now participate');
                setIsWaitingForNewRace(false);
                isWaitingRef.current = false;
                setRaceData(raceDataFromDB);
              } else {
                console.log(`🚫 Still waiting for new race - current state: ${raceDataFromDB.race_state} (${Math.round(waitingDuration/1000)}s)`);
                return; // Ignore updates while waiting
              }
            } else {
              setRaceData(raceDataFromDB);
            }
            
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

  // INDEPENDENT CLIENT-SIDE SMOOTH MOVEMENT - No server interference during racing
  useEffect(() => {
    if (!raceData || raceData.race_state !== 'racing') {
      // Cancel any running animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    console.log('🏇 Starting independent smooth movement system...');
    console.log(`🏇 Initial horse count: ${smoothHorses.length}`);
    console.log('🏇 Horse details:', smoothHorses.map(h => ({ name: h.name, id: h.id, velocity: h.velocity })));
    let lastUpdateTime = Date.now();

    const smoothMovementUpdate = () => {
      const now = Date.now();
      const deltaTime = (now - lastUpdateTime) / 1000; // Convert to seconds
      
      // Update at 60fps for ultra-smooth movement
      lastUpdateTime = now;

      setSmoothHorses(prevHorses => {
        if (prevHorses.length === 0) return prevHorses;
        
        let hasChanges = false;
        const updatedHorses = prevHorses.map((horse, index) => {
          // Calculate realistic horse speed if not set - ENSURE ALL HORSES GET VELOCITY
          let velocity = horse.velocity;
          if (!velocity || velocity <= 0 || isNaN(velocity)) {
            // Base speed from horse stats (speed + acceleration)
            const baseSpeed = ((horse.speed || 50) * 0.8 + (horse.acceleration || 50) * 0.2) / 100.0;
            
            // ELO-based performance modifier - higher ELO = better performance
            const horseElo = horse.elo || 500;
            const eloModifier = Math.max(0.7, Math.min(1.4, (horseElo / 500))); // 0.7x to 1.4x multiplier
            
            // Calculate realistic speed with ELO influence
            const realisticSpeed = 18.0 + (baseSpeed * 7.0 * eloModifier);
            
            // Add some randomness for race excitement (but less than before)
            const seedValue = (index + 1) * 0.123;
            const speedVariation = 0.95 + (seedValue % 1) * 0.1; // Reduced variation (5% instead of 30%)
            velocity = realisticSpeed * speedVariation;
            
            console.log(`🏇 Horse ${horse.name || horse.id || `Horse ${index + 1}`} velocity: ${velocity.toFixed(2)} m/s (ELO: ${horseElo}, modifier: ${eloModifier.toFixed(2)}x, baseSpeed: ${baseSpeed.toFixed(2)})`);
          }
          
          const currentPosition = horse.position || 0;
          
          // Calculate new position based on velocity and time
          const newPosition = Math.min(1200, currentPosition + (velocity * deltaTime));
          
          // Log position updates for debugging
          if (index < 3) { // Only log first 3 horses to avoid spam
            console.log(`🏇 Horse ${index + 1} (${horse.name}): ${currentPosition.toFixed(1)}m → ${newPosition.toFixed(1)}m (velocity: ${velocity.toFixed(2)} m/s)`);
          }
          
          // ALWAYS update position and velocity to ensure movement
          hasChanges = true;
          return {
            ...horse,
            position: newPosition,
            clientPosition: newPosition,
            velocity: velocity
          };
        });
        
        // Only return new array if there are actual changes
        return hasChanges ? updatedHorses : prevHorses;
      });
      
      // Continue the update loop
      animationFrameRef.current = requestAnimationFrame(smoothMovementUpdate);
    };

    // Start the smooth movement loop
    smoothMovementUpdate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [raceData?.race_state]);

  // SIMPLIFIED server sync - only sync when race state changes, not during racing
  useEffect(() => {
    if (!raceData) return;

    const now = Date.now();
    
    // Only sync server data when NOT racing (to avoid interfering with smooth movement)
    if (raceData.race_state !== 'racing' && raceData.horses) {
      console.log('🏇 Syncing server positions (non-racing state)');
      
      const staticHorses = raceData.horses.map((horse: any) => ({
        ...horse,
        serverPosition: horse.position || 0,
        clientPosition: horse.position || 0,
        velocity: 0,
        lastServerUpdate: now,
        position: horse.position || 0,
        predictedPosition: horse.position || 0
      }));
      setSmoothHorses(staticHorses);
    } else if (raceData.race_state === 'racing' && smoothHorses.length === 0) {
      // Initialize smooth horses only once when race starts
      console.log('🏇 Initializing smooth horses for racing');
      
      const initialHorses = raceData.horses.map((horse: any, index: number) => {
        // Base speed from horse stats (speed + acceleration)
        const baseSpeed = ((horse.speed || 50) * 0.8 + (horse.acceleration || 50) * 0.2) / 100.0;
        
        // ELO-based performance modifier - higher ELO = better performance
        const horseElo = horse.elo || 500;
        const eloModifier = Math.max(0.7, Math.min(1.4, (horseElo / 500))); // 0.7x to 1.4x multiplier
        
        // Calculate realistic speed with ELO influence
        const realisticSpeed = 18.0 + (baseSpeed * 7.0 * eloModifier);
        
        // Add some randomness for race excitement (but less than before)
        const seedValue = (index + 1) * 0.123;
        const speedVariation = 0.95 + (seedValue % 1) * 0.1; // Reduced variation (5% instead of 30%)
        const velocity = realisticSpeed * speedVariation;
        
        console.log(`🏇 Initializing horse ${horse.name || horse.id || `Horse ${index + 1}`} with velocity: ${velocity.toFixed(2)} m/s (ELO: ${horseElo}, modifier: ${eloModifier.toFixed(2)}x)`);
        
        return {
          ...horse,
          serverPosition: horse.position || 0,
          clientPosition: horse.position || 0,
          velocity: velocity,
          lastServerUpdate: now,
          position: horse.position || 0,
          predictedPosition: horse.position || 0
        };
      });
      setSmoothHorses(initialHorses);
    }
  }, [raceData?.race_state, raceData?.horses, smoothHorses.length]);

  // OPTIMIZED server timer - Call the correct race tick function
  useEffect(() => {
    if (!supabase || !isConnected) return;

    console.log('⚡ Starting race timer with update_race_tick...');
    
    timerInterval.current = setInterval(async () => {
      try {
        // Call the correct database function that waits for all horses
        if (supabase) {
          const { error } = await supabase.rpc('update_race_tick');
          
          if (error) {
            console.error('❌ Update error:', error);
          }
        }
      } catch (error) {
        console.error('❌ Timer error:', error);
      }
    }, 100); // 100ms = 10fps server updates

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

  // STABLE weather conditions - prevent flickering with ref caching
  const weatherConditionsRef = useRef<any>(null);
  const getWeatherConditions = useCallback(() => {
    const serverWeather = raceData?.weather_conditions;
    
    // If no server weather data, return cached or default
    if (!serverWeather) {
      if (weatherConditionsRef.current) {
        return weatherConditionsRef.current;
      }
      
      const defaultWeather = {
        timeOfDay: "day" as const,
        weather: "clear" as const,
        skyColor: "#87ceeb",
        ambientIntensity: 0.4,
        directionalIntensity: 1.0,
        trackColor: "#8B4513",
        grassColor: "#32cd32"
      };
      weatherConditionsRef.current = defaultWeather;
      return defaultWeather;
    }
    
    // Handle different weather formats from server
    if (typeof serverWeather === 'object') {
      let processedWeather;
      
      // Check if it's the new server format
      if ('condition' in serverWeather && 'humidity' in serverWeather) {
        const condition = serverWeather.condition as string;
        const isRainy = condition === 'rainy' || condition === 'rain';
        const isTwilight = condition === 'twilight' || condition === 'night';
        
        processedWeather = {
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
      else if ('timeOfDay' in serverWeather && 'weather' in serverWeather) {
        processedWeather = serverWeather as any;
      }
      
      // Only update cache if weather actually changed
      if (processedWeather && JSON.stringify(processedWeather) !== JSON.stringify(weatherConditionsRef.current)) {
        console.log('🌤️ Weather conditions updated:', processedWeather);
        weatherConditionsRef.current = processedWeather;
      }
      
      return weatherConditionsRef.current || processedWeather;
    }
    
    // Return cached weather if available
    return weatherConditionsRef.current || {
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

  // Manual unlock function for stuck clients
  const forceUnlockWaiting = useCallback(() => {
    console.log('🔓 Manually unlocking waiting client');
    setIsWaitingForNewRace(false);
    isWaitingRef.current = false;
    waitingStartTime.current = 0;
  }, []);

  return {
    // Core state
    raceData,
    isConnected,
    isLoading,
    isWaitingForNewRace,
    
    // Helper functions
    getCurrentHorses,
    getRaceState,
    getTimer,
    getRaceResults,
    getWeatherConditions,
    shouldShowPhotoFinish,
    shouldShowResults,
    getPhotoFinishResults,
    forceUnlockWaiting, // New function to manually unlock stuck clients
    
    // Legacy compatibility (for existing components)
    syncedData: raceData,
    updateRaceState: () => console.log('🚫 Client is read-only'),
    initializeNewRace: () => console.log('🚫 Database handles race creation'),
  };
}