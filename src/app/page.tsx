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
  const { syncedData, isConnected } = useRaceSync();
  
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

  // Get data from server - with safe defaults
  const horses = syncedData?.horses || [];
  const raceState = syncedData?.race_state || 'pre-race';
  const preRaceTimer = syncedData?.pre_race_timer || 10;
  const countdownTimer = syncedData?.countdown_timer || 0;
  const raceTimer = syncedData?.race_timer || 0;
  const raceResults = syncedData?.race_results || [];
  
  // Server-managed UI states
  const showPhotoFinishFromServer = syncedData?.show_photo_finish || false;
  const showResultsFromServer = syncedData?.show_results || false;
  const photoFinishResultsFromServer = syncedData?.photo_finish_results || [];
  const serverWeatherConditions = syncedData?.weather_conditions || null;

  // Fetch horse ELO data from database and merge with race data
  const [horseEloData, setHorseEloData] = useState<Record<string, any>>({});
  
  useEffect(() => {
    const fetchHorseEloData = async () => {
      if (!supabase || horses.length === 0) return;
      
      try {
        const horseNames = horses.map(h => h.name);
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
        console.log('🏇 Fetched horse ELO data:', eloMap);
      } catch (error) {
        console.error('Error fetching horse ELO data:', error);
      }
    };
    
    fetchHorseEloData();
  }, [horses, supabase]);

  // Merge database ELO data with race horses
  const horsesWithElo = horses.map(horse => ({
    ...horse,
    elo: horseEloData[horse.name]?.elo || 500, // Use database ELO or default 500
    totalRaces: horseEloData[horse.name]?.total_races || 0,
    wins: horseEloData[horse.name]?.wins || 0,
    recentForm: horseEloData[horse.name]?.recent_form || []
  }));

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

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

  // Convert horses array to display format (horses have position data during race)
  const displayProgress = horsesWithElo.map(horse => ({
    id: horse.id,
    name: horse.name,
    position: horse.position || 0, // Use position directly from horse object
    speed: 0, // Speed calculation can be added later if needed
    horse: horse
  }));

  // Debug race progress data
  useEffect(() => {
    if (horsesWithElo.length > 0 && raceState === 'racing') {
      console.log('🏇 Horse Position Data:', {
        raceState,
        raceTimer,
        sampleHorses: horsesWithElo.slice(0, 3).map(h => ({
          id: h.id,
          name: h.name,
          position: h.position || 0,
          elo: h.elo
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
      console.log('🏆 Server says show results');
      setShowResults(true);
      setShowPhotoFinish(false);
      setEloRefreshTrigger(prev => prev + 1);
    } else if (!showPhotoFinishFromServer) {
      setShowResults(false);
    }
  }, [showPhotoFinishFromServer, showResultsFromServer, photoFinishResultsFromServer, raceResults.length]);

  // Show results when race finishes
  useEffect(() => {
    if (raceState === 'finished' && raceResults.length > 0) {
      console.log('🏆 Race finished, showing results');
      setShowResults(true);
      setEloRefreshTrigger(prev => prev + 1);
    } else {
      setShowResults(false);
    }
  }, [raceState, raceResults.length]);

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

  // Reset all ELO ratings to 500 (for testing)
  const handleResetElo = () => {
    resetAllEloRatings();
    // Force a re-render by updating horses
    setHorsesWithElo(generateRandomHorses(8));
    console.log('🔄 All ELO ratings reset to 500!');
  };

  // Betting handler (placeholder - not used in server-controlled version)
  const handleBet = (horse: Horse, amount: number) => {
    setSelectedBet({ horseId: horse.id, amount });
  };

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
        <div className={`px-4 py-2 rounded-lg text-center text-sm font-medium ${
          isConnected 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          {isConnected 
            ? '🟢 Connected to Race Server' 
            : '🔴 Disconnected from Race Server'
          }
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto">
        {/* Main Race Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 mb-6">
          {/* Horse Lineup */}
          <div className="lg:col-span-2">
            <HorseLineup 
              horses={horsesWithElo} 
              onPlaceBet={handlePlaceBet}
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
          
          {/* Race Controller - now just displays server state */}
          <div className="lg:col-span-1">
            <RaceController
              horses={horses}
              onRaceProgress={handleRaceProgress}
              onRaceComplete={handleRaceComplete}
              onRaceStateChange={handleRaceStateChange}
              raceState={raceState}
              preRaceTimer={preRaceTimer}
              countdownTimer={countdownTimer}
              raceTimer={raceTimer}
            />
          </div>
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
        />
      )}
    </div>
  );
}