'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { generateRandomHorses, updateEloRatings, getStoredEloRatings, updateHorseStats } from '@/data/horses';
import { Horse, RaceResult, RaceState } from '@/types/horse';
import { useRaceSync } from '@/hooks/useRaceSync';
import HorseLineup from '@/components/HorseLineup';
import RaceTrack from '@/components/RaceTrack';
import RaceController from '@/components/RaceController';
import RaceResults from '@/components/RaceResults';
import EloLeaderboard from '@/components/EloLeaderboard';
import PhotoFinish from '@/components/PhotoFinish';

export default function Home() {
  const { syncedData, isConnected, updateRaceState, initializeNewRace } = useRaceSync();
  
  // Local state for offline mode
  const [localHorses, setLocalHorses] = useState<Horse[]>([]);
  const [localRaceState, setLocalRaceState] = useState<RaceState>('pre-race');
  const [localPreRaceTimer, setLocalPreRaceTimer] = useState(10);
  
  // Local state for UI components
  const [raceResults, setRaceResults] = useState<RaceResult[] | null>(null);
  const [eloRefreshTrigger, setEloRefreshTrigger] = useState(0);
  const [raceProgress, setRaceProgress] = useState<Array<{
    id: string;
    name: string;
    position: number;
    speed: number;
    horse?: Horse;
  }>>([]);
  
  // Photo Finish states
  const [showPhotoFinish, setShowPhotoFinish] = useState(false);
  const [photoFinishResults, setPhotoFinishResults] = useState<RaceResult[] | null>(null);

  // Use synced data if connected, otherwise use local state
  const horses = isConnected ? (syncedData?.horses || []) : localHorses;
  const raceState = isConnected ? (syncedData?.race_state || 'pre-race') : localRaceState;
  const preRaceTimer = isConnected ? (syncedData?.pre_race_timer || 10) : localPreRaceTimer;

  // Initialize race when component mounts - only if no race exists
  useEffect(() => {
    const initializeRaceIfNeeded = async () => {
      if (isConnected) {
        // Wait a bit for syncedData to load
        setTimeout(() => {
          if (!syncedData || syncedData.horses.length === 0) {
            console.log('🏇 No existing race found, creating new one...');
            const newHorses = generateRandomHorses(8);
            initializeNewRace(newHorses);
          } else {
            console.log('🏇 Using existing race with', syncedData.horses.length, 'horses');
          }
        }, 1000);
      } else if (!isConnected && localHorses.length === 0) {
        // Offline mode - only initialize local state if empty
        console.log('🏇 Offline mode - creating local race');
        setLocalHorses(generateRandomHorses(8));
        setLocalRaceState('pre-race');
        setLocalPreRaceTimer(10);
      }
    };

    initializeRaceIfNeeded();
  }, [isConnected]); // Only depend on connection status

  // Handle race progress updates from server
  const handleRaceProgress = useCallback((progress: Array<{
    id: string;
    name: string;
    position: number;
    speed: number;
    horse?: Horse;
  }>) => {
    // Only update if we have server race progress data
    if (syncedData?.race_progress && Object.keys(syncedData.race_progress).length > 0) {
      // Use server race progress instead of client simulation
      const serverProgress = Object.entries(syncedData.race_progress).map(([horseId, data]: [string, any]) => ({
        id: horseId,
        name: horses.find(h => h.id === horseId)?.name || 'Unknown',
        position: data.position || 0,
        speed: data.speed || 0,
        horse: horses.find(h => h.id === horseId)
      }));
      
      setRaceProgress(serverProgress);
      console.log('📊 Using server race progress:', serverProgress);
    } else {
      // Fallback to client progress if no server data
      setRaceProgress(progress);
    }
  }, [syncedData?.race_progress, horses]);

  // Handle race state changes from RaceController
  const handleRaceStateChange = (newState: RaceState) => {
    if (isConnected) {
      updateRaceState({ race_state: newState });
    } else {
      setLocalRaceState(newState);
    }
  };

  // Pre-race timer effect - only for offline mode
  useEffect(() => {
    let preRaceInterval: NodeJS.Timeout;
    
    // Only handle timer locally when offline
    if (!isConnected && raceState === 'pre-race' && horses.length > 0 && preRaceTimer > 0) {
      preRaceInterval = setTimeout(() => {
        setLocalPreRaceTimer(preRaceTimer - 1);
      }, 1000);
    } else if (!isConnected && raceState === 'pre-race' && preRaceTimer === 0) {
      setLocalRaceState('countdown');
    }
    
    return () => {
      if (preRaceInterval) {
        clearTimeout(preRaceInterval);
      }
    };
  }, [raceState, horses.length, preRaceTimer, isConnected]);

  // Function to check if top 3 horses finished close together (within 0.1 seconds)
  const isPhotoFinishNeeded = (results: RaceResult[]): boolean => {
    if (results.length < 3) return false;
    
    // Sort by placement to get top 3
    const sortedResults = [...results].sort((a, b) => a.placement - b.placement);
    const top3 = sortedResults.slice(0, 3);
    
    // Check if any of the top 3 finished within 0.1 seconds of each other
    for (let i = 0; i < top3.length - 1; i++) {
      const timeDiff = Math.abs(top3[i].finishTime - top3[i + 1].finishTime);
      if (timeDiff <= 0.1) {
        console.log(`🏁 Photo finish needed! ${top3[i].name} and ${top3[i + 1].name} finished ${timeDiff.toFixed(6)}s apart`);
        return true;
      }
    }
    
    return false;
  };

  // Reset pre-race timer when starting a new race
  const handleNewRace = () => {
    console.log('Starting new race...');
    setRaceResults(null);
    setPhotoFinishResults(null);
    setShowPhotoFinish(false);
    
    const newHorses = generateRandomHorses(8);
    if (isConnected) {
      initializeNewRace(newHorses);
    } else {
      setLocalHorses(newHorses);
      setLocalRaceState('pre-race');
      setLocalPreRaceTimer(10);
    }
  };

  // Handle race completion from server
  const handleRaceComplete = useCallback((results: RaceResult[]) => {
    // Check if we have server results
    if (syncedData?.race_results && syncedData.race_results.length > 0) {
      console.log('🏆 Using server race results:', syncedData.race_results);
      setRaceResults(syncedData.race_results);
      setRaceState('finished');
    } else {
      // Fallback to client results
      console.log('🏆 Using client race results:', results);
      setRaceResults(results);
      setRaceState('finished');
    }
  }, [syncedData?.race_results]);

  const handlePhotoFinishComplete = (finalResults: RaceResult[]) => {
    console.log('📸 Photo finish complete, showing final results...');
    setShowPhotoFinish(false);
    setRaceResults(finalResults);
    setEloRefreshTrigger(prev => prev + 1);
  };

  const handleVisualFinish = (results: RaceResult[]) => {
    console.log('🏁 Visual finish detected! Showing results...');
    setShowPhotoFinish(false);
    setRaceResults(results);
    setEloRefreshTrigger(prev => prev + 1);
  };

  const processRaceResultsData = (results: RaceResult[]) => {
    // Get ELO ratings before updating them
    const beforeRatings = getStoredEloRatings();
    
    // Update ELO ratings
    console.log('🏁 Race finished! Updating ELO ratings...');
    const eloData = results.map(horse => ({
      name: horse.name,
      placement: horse.placement
    }));
    updateEloRatings(eloData);
    
    // Update horse statistics (wins and form)
    console.log('📊 Updating horse statistics...');
    updateHorseStats(eloData);
    
    // Get ELO ratings after updating them
    const afterRatings = getStoredEloRatings();
    
    // Calculate ELO changes and add them to results
    const resultsWithEloChanges = results.map(horse => {
      const horseName = horse.horse?.name || horse.name;
      const beforeElo = beforeRatings[horseName] || 500;
      const afterElo = afterRatings[horseName] || 500;
      const change = afterElo - beforeElo;
      
      return {
        ...horse,
        eloChange: {
          before: beforeElo,
          after: afterElo,
          change: Math.round(change)
        }
      };
    });
    
    return resultsWithEloChanges;
  };

  // Handle server race completion
  useEffect(() => {
    if (syncedData?.race_state === 'finished' && syncedData?.race_results && syncedData.race_results.length > 0) {
      console.log('🏆 Server indicates race finished, showing results');
      setRaceResults(syncedData.race_results);
      setRaceState('finished');
    }
  }, [syncedData?.race_state, syncedData?.race_results]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-slate-900 p-4">
      {/* Show connection status */}
      {!isConnected && (
        <div className="bg-yellow-600 text-white px-4 py-2 rounded-lg mb-4 text-center">
          🏇 Running in offline mode - race data won't sync between devices
        </div>
      )}
      
      <div className="max-w-7xl mx-auto">
        {/* Top Row: Horse Lineup + Race Track */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 mb-6">
          {/* Horse Lineup */}
          <div className="lg:col-span-2">
            <HorseLineup horses={horses} />
          </div>
          
          {/* Race Track */}
          <div className="lg:col-span-5">
            <RaceTrack 
              horses={horses} 
              raceState={raceState}
              progress={raceProgress.length > 0 ? raceProgress : horses.map(horse => ({
                id: horse.id,
                name: horse.name,
                position: 0,
                speed: 0,
                horse: horse
              }))}
              isRacing={raceState === 'racing'}
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
          <div className="lg:col-span-1">
            <RaceController
              horses={horses}
              onRaceProgress={handleRaceProgress}
              onRaceComplete={handleRaceComplete}
              onRaceStateChange={handleRaceStateChange}
              raceState={raceState}
              preRaceTimer={preRaceTimer}
              countdownTimer={syncedData?.countdown_timer || 0}
              raceTimer={syncedData?.race_timer || 0}
            />
          </div>
        </div>
      </div>

      {/* Photo Finish Component - shows when close finish detected */}
      {showPhotoFinish && photoFinishResults && (
        <PhotoFinish
          finishingHorses={photoFinishResults.slice(0, 3)} // Only show top 3 for photo finish
          onPhotoFinishComplete={handlePhotoFinishComplete}
          isVisible={showPhotoFinish}
        />
      )}

      {/* Race Results Modal - show after photo finish (if any) completes */}
      {raceState === 'finished' && raceResults && !showPhotoFinish && (
        <RaceResults
          results={raceResults}
          isOpen={true}
          onClose={() => {
            setRaceResults(null);
          }}
          onNewRace={handleNewRace}
        />
      )}
    </div>
  );
}