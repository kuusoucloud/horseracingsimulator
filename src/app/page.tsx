'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Horse, RaceResult, Bet } from '@/types/horse';
import { useRaceSync } from '@/hooks/useRaceSync';
import { generateRandomHorses, updateEloRatings, updateHorseStats } from '@/data/horses';
import HorseLineup from '@/components/HorseLineup';
import RaceTrack from '@/components/RaceTrack';
import RaceController from '@/components/RaceController';
import RaceResults from '@/components/RaceResults';
import EloLeaderboard from '@/components/EloLeaderboard';
import PhotoFinish from '@/components/PhotoFinish';

export default function Home() {
  // Use the optimized race sync hook with smooth horses
  const { 
    raceData,
    isConnected,
    isLoading,
    isWaitingForNewRace, // NEW: Check if waiting for next race
    getCurrentHorses,
    getRaceState,
    getTimer,
    getRaceResults,
    getWeatherConditions,
    shouldShowPhotoFinish,
    shouldShowResults,
    getPhotoFinishResults,
    forceUnlockWaiting // NEW: Manual unlock function
  } = useRaceSync();
  
  // Client-side hydration state
  const [isClient, setIsClient] = useState(false);
  
  // UI state for displaying results
  const [showResults, setShowResults] = useState(false);
  const [eloRefreshTrigger, setEloRefreshTrigger] = useState(0);
  
  // Betting state (placeholder - not used in server-controlled version)
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null);
  
  // Photo Finish states
  const [showPhotoFinish, setShowPhotoFinish] = useState(false);
  const [photoFinishResults, setPhotoFinishResults] = useState<RaceResult[] | null>(null);

  // Get optimized data from race sync hook
  const horses = getCurrentHorses(); // This returns smooth horses during racing!
  const raceState = getRaceState();
  const raceResults = getRaceResults();
  const serverWeatherConditions = getWeatherConditions();
  
  // Get timer based on race state
  const timer = getTimer();
  const preRaceTimer = raceState === 'pre-race' ? timer : 10;
  const countdownTimer = raceState === 'countdown' ? timer : 0;
  const raceTimer = raceState === 'racing' ? timer : 0;
  const resultsTimer = raceState === 'finished' ? timer : 0; // Add results timer
  const resultsCountdown = raceState === 'finished' ? timer : 0; // Add results countdown for RaceController
  
  // Server-managed UI states
  const showPhotoFinishFromServer = shouldShowPhotoFinish();
  const showResultsFromServer = shouldShowResults();
  const photoFinishResultsFromServer = getPhotoFinishResults();

  // Fetch horse ELO data from database and merge with race data - WITH CACHING
  const [horseEloData, setHorseEloData] = useState<Record<string, any>>({});
  const [lastFetchedHorses, setLastFetchedHorses] = useState<string>('');
  
  useEffect(() => {
    const fetchHorseEloData = async () => {
      if (!supabase || horses.length === 0) return;
      
      // Create a stable hash of horse names to prevent unnecessary refetches
      const horseNamesHash = horses.map((h: Horse) => h.name).sort().join('|');
      
      // Only fetch if horses actually changed
      if (horseNamesHash === lastFetchedHorses) {
        return; // Skip fetch - same horses as before
      }
      
      try {
        const horseNames = horses.map((h: Horse) => h.name);
        console.log('🏇 Fetching ELO data for horses:', horseNames);
        
        const { data: dbHorses, error } = await supabase
          .from('horses')
          .select('name, elo, total_races, wins, recent_form')
          .in('name', horseNames);
          
        if (error) {
          console.error('Error fetching horse ELO data:', error);
          return;
        }
        
        const eloMap: Record<string, any> = {};
        dbHorses?.forEach(horse => {
          eloMap[horse.name] = horse;
        });
        
        setHorseEloData(eloMap);
        setLastFetchedHorses(horseNamesHash);
        console.log('🏇 Successfully fetched horse ELO data:', eloMap);
      } catch (error) {
        console.error('Error fetching horse ELO data:', error);
        // Don't update lastFetchedHorses on error so we can retry
      }
    };
    
    // Debounce the fetch to prevent rapid-fire requests
    const timeoutId = setTimeout(fetchHorseEloData, 500);
    return () => clearTimeout(timeoutId);
  }, [horses, supabase, lastFetchedHorses]);

  // Merge database ELO data with race horses
  const horsesWithElo = horses.map((horse: Horse) => ({
    ...horse,
    elo: horseEloData[horse.name]?.elo || 500, // Use database ELO or default 500
    totalRaces: horseEloData[horse.name]?.total_races || 0,
    wins: horseEloData[horse.name]?.wins || 0,
    recentForm: horseEloData[horse.name]?.recent_form || []
  }));

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
    
    // Initialize race system if no horses are loading
    const initializeIfNeeded = async () => {
      if (!supabase || !isConnected) return;
      
      // Wait a bit for initial data to load
      setTimeout(async () => {
        if (horses.length === 0 && raceState === 'pre-race' && supabase) {
          console.log('🏇 No horses detected, initializing race system...');
          try {
            const { data, error } = await supabase.functions.invoke('supabase-functions-race-initialization', {
              body: { action: 'initialize_system' }
            });
            
            if (error) {
              console.error('❌ Race initialization error:', error);
            } else {
              console.log('✅ Race system initialized:', data);
            }
          } catch (err) {
            console.error('❌ Race initialization failed:', err);
          }
        }
      }, 3000); // Wait 3 seconds for initial load
    };
    
    initializeIfNeeded();
  }, [isConnected, horses.length, raceState, supabase]);

  // Debug weather conditions
  useEffect(() => {
    if (serverWeatherConditions) {
      console.log('🌤️ Server weather received:', {
        type: typeof serverWeatherConditions,
        keys: Object.keys(serverWeatherConditions),
        data: serverWeatherConditions
      });
    }
  }, [serverWeatherConditions]);

  // Convert horses array to display format - horses already have smooth positions!
  const displayProgress = horsesWithElo.map((horse: Horse) => ({
    id: horse.id,
    name: horse.name,
    position: horse.position || 0, // This is now smooth position during racing!
    speed: 0, // Speed calculation can be added later if needed
    horse: horse
  }));

  // Debug race progress data
  useEffect(() => {
    if (horsesWithElo.length > 0 && raceState === 'racing') {
      console.log('🏇 Smooth Horse Position Data:', {
        raceState,
        raceTimer,
        sampleHorses: horsesWithElo.slice(0, 3).map((h: Horse) => ({
          id: h.id,
          name: h.name,
          position: h.position || 0,
          elo: h.elo,
          isSmooth: (h as any).clientPosition !== undefined // Check if this is a smooth horse
        }))
      });
    }
  }, [horsesWithElo, raceState, raceTimer]);

  // Update UI states based on server
  useEffect(() => {
    // Update photo finish state
    if (showPhotoFinishFromServer && photoFinishResultsFromServer.length > 0) {
      console.log('📸 Server says show photo finish');
      setShowPhotoFinish(true);
      setPhotoFinishResults(photoFinishResultsFromServer);
      setShowResults(false);
    } else {
      setShowPhotoFinish(false);
    }
    
    // Update results state
    if (showResultsFromServer && raceResults.length > 0) {
      console.log('🏆 Server says show results - FORCING display');
      setShowResults(true);
      setShowPhotoFinish(false);
      setEloRefreshTrigger(prev => prev + 1);
    } else if (raceState === 'finished' && raceResults.length > 0) {
      console.log('🏆 Race finished, showing results as fallback');
      setShowResults(true);
      setEloRefreshTrigger(prev => prev + 1);
    } else if (raceState !== 'finished') {
      setShowResults(false);
    }
  }, [showPhotoFinishFromServer, showResultsFromServer, raceResults.length]);

  // Show results when race finishes - ALWAYS show if server says to
  useEffect(() => {
    if (showResultsFromServer && raceResults.length > 0) {
      console.log('🏆 Server says show results - FORCING display');
      setShowResults(true);
      setShowPhotoFinish(false);
      setEloRefreshTrigger(prev => prev + 1);
    } else if (raceState === 'finished' && raceResults.length > 0) {
      console.log('🏆 Race finished, showing results as fallback');
      setShowResults(true);
      setEloRefreshTrigger(prev => prev + 1);
    } else if (raceState !== 'finished') {
      setShowResults(false);
    }
  }, [showResultsFromServer, raceState, raceResults.length]);

  // Dummy handlers for components that expect them (but won't be used)
  const handleRaceProgress = useCallback(() => {
    // No-op - server handles all progress
  }, []);

  const handleRaceComplete = useCallback(() => {
    // No-op - server handles completion
  }, []);

  const handleRaceStateChange = useCallback(() => {
    // No-op - server handles state changes
  }, []);

  const handleNewRace = () => {
    console.log('🔄 New race will start automatically from server');
    setShowResults(false);
    setPhotoFinishResults(null);
    setShowPhotoFinish(false);
  };

  const handlePhotoFinishComplete = (finalResults: RaceResult[]) => {
    console.log('📸 Photo finish complete - server will handle transition to results');
    // Server handles the transition, client just acknowledges
  };

  // Betting handler (placeholder - not used in server-controlled version)
  const handleBet = (horse: Horse, amount: number) => {
    setSelectedBet({ 
      horseId: horse.id, 
      horseName: horse.name,
      amount,
      odds: horse.odds
    });
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-100 to-green-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-green-800">Loading Race System...</h2>
        </div>
      </div>
    );
  }

  // Show waiting message if client connected mid-race
  if (isWaitingForNewRace) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-yellow-100 to-orange-200 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg">
          <div className="animate-pulse text-6xl mb-4">🏇</div>
          <h2 className="text-3xl font-bold text-orange-800 mb-4">Race in Progress</h2>
          <p className="text-lg text-orange-700 mb-6">
            You've connected during an active race. Please wait for the current race to finish 
            and a new race to begin.
          </p>
          <div className="flex items-center justify-center space-x-2 text-orange-600 mb-6">
            <div className="animate-bounce">⏳</div>
            <span className="font-medium">Waiting for next race...</span>
            <div className="animate-bounce" style={{ animationDelay: '0.1s' }}>⏳</div>
          </div>
          <p className="text-sm text-orange-600">
            Auto-unlock after 60 seconds if stuck
          </p>
        </div>
      </div>
    );
  }

  // Don't render until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-slate-900 p-4 flex items-center justify-center">
        <div className="text-white text-xl">Loading Horse Racing App...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-slate-900 p-4">
      {/* Connection status */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="flex items-center justify-between">
          <div className={`px-4 py-2 rounded-lg text-center text-sm font-medium flex-1 ${
            isConnected 
              ? 'bg-green-600 text-white' 
              : 'bg-red-600 text-white'
          }`}>
            {isConnected 
              ? '🟢 Connected to Race Server' 
              : '🔴 Disconnected from Race Server'
            }
          </div>
          
          {/* Emergency initialization button */}
          {horses.length === 0 && supabase && (
            <button
              onClick={async () => {
                if (!supabase) return;
                console.log('🏇 Manual race initialization...');
                try {
                  const { data, error } = await supabase.functions.invoke('supabase-functions-race-initialization', {
                    body: { action: 'initialize_system' }
                  });
                  
                  if (error) {
                    console.error('❌ Manual initialization error:', error);
                    alert(`Initialization failed: ${error.message}`);
                  } else {
                    console.log('✅ Manual initialization success:', data);
                    alert('Race system initialized! Horses should appear shortly.');
                  }
                } catch (err) {
                  console.error('❌ Manual initialization failed:', err);
                  alert(`Initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
              }}
              className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              🔧 Initialize Races
            </button>
          )}
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto">
        {/* Main Race Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 mb-6">
          {/* Horse Lineup */}
          <div className="lg:col-span-2">
            <HorseLineup 
              horses={horsesWithElo} 
              onPlaceBet={handleBet}
              selectedBet={selectedBet}
              raceInProgress={raceState === 'racing'}
            />
          </div>
          
          {/* Race Track */}
          <div className="lg:col-span-5">
            <RaceTrack 
              horses={horsesWithElo} 
              raceState={raceState}
              progress={displayProgress}
              isRacing={raceState === 'racing'}
              serverWeatherConditions={serverWeatherConditions}
            />
          </div>
        </div>
        
        {/* Second Row: ELO Leaderboard + Race Controller */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
          {/* ELO Leaderboard */}
          <div className="lg:col-span-4">
            <EloLeaderboard refreshTrigger={eloRefreshTrigger} />
          </div>
          
          {/* Race Controller */}
          <RaceController
            horses={horses}
            raceState={raceState}
            preRaceTimer={preRaceTimer}
            countdownTimer={countdownTimer}
            raceTimer={raceTimer}
            resultsCountdown={resultsCountdown}
            isWaitingForNewRace={isWaitingForNewRace}
            onRaceProgress={() => console.log('Race progress')}
            onRaceComplete={() => console.log('Race complete')}
            onRaceStateChange={() => console.log('Race state change')}
          />
        </div>
      </div>

      {/* Photo Finish Component */}
      {showPhotoFinish && photoFinishResults && (
        <PhotoFinish
          results={photoFinishResults.slice(0, 3)}
          onClose={() => handlePhotoFinishComplete(photoFinishResults)}
          isVisible={showPhotoFinish}
        />
      )}

      {/* Race Results Modal */}
      {showResults && raceResults.length > 0 && !showPhotoFinish && (
        <RaceResults
          results={raceResults}
          isOpen={true}
          onClose={() => console.log('🚫 Results close handled by server')}
          onNewRace={handleNewRace}
          autoCloseTimer={resultsTimer}
        />
      )}
    </div>
  );
}