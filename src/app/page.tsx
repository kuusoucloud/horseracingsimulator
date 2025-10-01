'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Horse, RaceResult, RaceState } from '@/types/horse';
import { useRaceSync } from '@/hooks/useRaceSync';
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
  
  // Photo Finish states
  const [showPhotoFinish, setShowPhotoFinish] = useState(false);
  const [photoFinishResults, setPhotoFinishResults] = useState<RaceResult[] | null>(null);

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

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
  const displayProgress = horses.map(horse => ({
    id: horse.id,
    name: horse.name,
    position: horse.position || 0, // Use position directly from horse object
    speed: 0, // Speed calculation can be added later if needed
    horse: horse
  }));

  // Debug race progress data
  useEffect(() => {
    if (horses.length > 0 && raceState === 'racing') {
      console.log('🏇 Horse Position Data:', {
        raceState,
        raceTimer,
        sampleHorses: horses.slice(0, 3).map(h => ({
          id: h.id,
          name: h.name,
          position: h.position || 0
        }))
      });
    }
  }, [horses, raceState, raceTimer]);

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