"use client";

import React, { useState, useEffect } from 'react';
import { Horse, RaceResult, RaceState } from '@/types/horse';
import { getRandomHorses, calculateOddsFromELO } from '@/data/horses';
import HorseLineup from '@/components/HorseLineup';
import RaceTrack from '@/components/RaceTrack';
import RaceController from '@/components/RaceController';
import RaceResults from '@/components/RaceResults';

// Generate random horse attributes
function generateHorseAttributes(horseData: any): Horse {
  const baseSpeed = 70 + Math.random() * 25; // 70-95
  const baseStamina = 70 + Math.random() * 25; // 70-95
  const baseAcceleration = 70 + Math.random() * 25; // 70-95
  
  // ELO influences attributes
  const eloFactor = (horseData.elo - 1000) / 1000; // -0.68 to 0.97
  const speed = Math.max(50, Math.min(100, baseSpeed + (eloFactor * 15)));
  const stamina = Math.max(50, Math.min(100, baseStamina + (eloFactor * 15)));
  const acceleration = Math.max(50, Math.min(100, baseAcceleration + (eloFactor * 15)));
  
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: horseData.name,
    speed: Math.round(speed),
    stamina: Math.round(stamina),
    acceleration: Math.round(acceleration),
    odds: 0, // Will be calculated later
    color: `hsl(${Math.random() * 360}, 70%, 45%)`,
    elo: horseData.elo, // Include ELO from database
    sprintStartPercent: 40 + Math.random() * 35, // 40-75%
    earlyAdvantage: 0.9 + Math.random() * 0.3, // 0.9-1.2x
    isEarlyRunner: Math.random() < 0.3, // 30% chance
    lane: 0 // Will be set later
  };
}

export default function Home() {
  const [horses, setHorses] = useState<Horse[]>([]);
  const [raceState, setRaceState] = useState<RaceState>("pre-race");
  const [raceProgress, setRaceProgress] = useState<Array<{
    id: string;
    name: string;
    position: number;
    speed: number;
  }>>([]);
  const [raceResults, setRaceResults] = useState<RaceResult[]>([]);
  const [photoFinish, setPhotoFinish] = useState<{
    isActive: boolean;
    horses: Array<{ id: string; name: string; position: number }>;
  } | undefined>();
  const [autoStartTimer, setAutoStartTimer] = useState<number>(10);
  const [autoCloseTimer, setAutoCloseTimer] = useState<number>(15);

  // Generate horses on component mount
  useEffect(() => {
    const horseData = getRandomHorses(8);
    const generatedHorses = horseData.map((data, index) => ({
      ...generateHorseAttributes(data),
      lane: index + 1
    }));
    
    // Calculate odds based on ELO
    const oddsData = calculateOddsFromELO(horseData);
    const horsesWithOdds = generatedHorses.map(horse => ({
      ...horse,
      odds: oddsData.find(o => o.name === horse.name)?.odds || 5.0
    }));
    
    setHorses(horsesWithOdds);
    
    // Immediately set initial race progress so horses appear at starting line
    const initialProgress = horsesWithOdds.map(horse => ({
      id: horse.id,
      name: horse.name,
      position: 0, // Start at position 0 (starting line)
      speed: 0,
      horse: horse // Include the full horse object to maintain lane info
    }));
    setRaceProgress(initialProgress);
    console.log("Set initial race progress:", initialProgress);
  }, []);

  // Auto-start timer for pre-race state
  useEffect(() => {
    if (raceState === "pre-race" && autoStartTimer > 0) {
      const timer = setTimeout(() => {
        setAutoStartTimer(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (raceState === "pre-race" && autoStartTimer === 0) {
      handleStartRace();
    }
  }, [raceState, autoStartTimer]);

  // Auto-close timer for race results
  useEffect(() => {
    if (raceState === "finished" && autoCloseTimer > 0) {
      const timer = setTimeout(() => {
        setAutoCloseTimer(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (raceState === "finished" && autoCloseTimer === 0) {
      handleNewRace();
    }
  }, [raceState, autoCloseTimer]);

  // Handle race state transitions
  useEffect(() => {
    if (raceState === "countdown") {
      console.log("Race state is countdown, will transition to racing in 10 seconds");
      // After 10 seconds, transition to racing
      const timer = setTimeout(() => {
        console.log("Transitioning from countdown to racing");
        setRaceState("racing");
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [raceState]);

  const handleRaceProgress = (progress: Array<{
    id: string;
    name: string;
    position: number;
    speed: number;
  }>) => {
    setRaceProgress(progress);
  };

  const handleRaceComplete = (results: RaceResult[]) => {
    // Check for photo finish based on finish times of top finishers
    const topThree = results.slice(0, 3);
    
    // Only check photo finish if we have at least 2 horses that actually finished
    const finishedHorses = topThree.filter(h => h.finalPosition >= 1200);
    
    if (finishedHorses.length >= 2) {
      // Calculate the gap between 1st and 2nd place finish times
      const firstPlaceTime = finishedHorses[0].finishTime || 0;
      const secondPlaceTime = finishedHorses[1].finishTime || 0;
      const finishTimeGap = Math.abs(secondPlaceTime - firstPlaceTime);
      
      // Photo finish if 1st and 2nd place finish within 150ms of each other
      if (finishTimeGap <= 150) {
        setPhotoFinish({
          isActive: true,
          horses: finishedHorses.slice(0, 2).map(h => ({
            id: h.id,
            name: h.name,
            position: h.finalPosition || 1200
          }))
        });
        
        // Show photo finish for 3 seconds, then show results
        setTimeout(() => {
          setPhotoFinish(undefined);
          setRaceResults(results);
          setRaceState("finished");
          setAutoCloseTimer(15);
        }, 3000);
      } else {
        // No photo finish, show results immediately
        setRaceResults(results);
        setRaceState("finished");
        setPhotoFinish(undefined);
        setAutoCloseTimer(15);
      }
    } else {
      // Not enough horses finished for photo finish
      setRaceResults(results);
      setRaceState("finished");
      setPhotoFinish(undefined);
      setAutoCloseTimer(15);
    }
  };

  const handleStartRace = () => {
    console.log("handleStartRace called, setting state to countdown"); // Debug log
    setRaceState("countdown");
    setRaceResults([]);
    setPhotoFinish(undefined);
    // Don't clear race progress - keep horses at starting line
    // setRaceProgress([]);
  };

  const handleNewRace = () => {
    // Generate new horses
    const horseData = getRandomHorses(8);
    const generatedHorses = horseData.map((data, index) => ({
      ...generateHorseAttributes(data),
      lane: index + 1
    }));
    
    const oddsData = calculateOddsFromELO(horseData);
    const horsesWithOdds = generatedHorses.map(horse => ({
      ...horse,
      odds: oddsData.find(o => o.name === horse.name)?.odds || 5.0
    }));
    
    setHorses(horsesWithOdds);
    setRaceState("pre-race");
    setRaceProgress([]);
    setRaceResults([]);
    setPhotoFinish(undefined);
    // Reset timers
    setAutoStartTimer(10);
    setAutoCloseTimer(15);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Horse Lineup */}
          <div className="lg:col-span-1">
            <HorseLineup horses={horses} />
          </div>

          {/* Main Race Area */}
          <div className="lg:col-span-3 flex flex-col h-[800px]">
            {/* Race Controller - Fixed height */}
            <div className="flex-shrink-0 mb-4">
              <RaceController
                horses={horses}
                onRaceProgress={handleRaceProgress}
                onRaceComplete={handleRaceComplete}
                onStartRace={handleStartRace}
                raceState={raceState}
                autoStartTimer={autoStartTimer}
              />
            </div>

            {/* 3D Race Track */}
            <div className="flex-1 min-h-0 relative">
              <RaceTrack
                progress={raceProgress}
                isRacing={raceState === "racing" || raceState === "countdown"}
                raceState={raceState}
              />
            </div>

            {/* Live Standings - Below 3D view, compact design */}
            {raceState === "racing" && horses && horses.length > 0 && (
              <div className="flex-shrink-0 mt-2 relative overflow-hidden max-h-32">
                {/* Glassmorphism container */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl">
                  {/* Animated gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10 rounded-lg" />
                  
                  {/* Glow effects */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-yellow-500/20 rounded-lg blur-xl opacity-50" />
                </div>
                
                <div className="relative z-10 p-3 h-full overflow-y-auto">
                  <h3 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 mb-2">🏁 Live Standings</h3>
                  <div className="flex flex-wrap gap-2">
                    {horses
                      .map(horse => ({
                        ...horse,
                        currentPosition: raceProgress.find(p => p.id === horse.id)?.position || 0,
                        metres: Math.round(raceProgress.find(p => p.id === horse.id)?.position || 0),
                        percentage: Math.round(((raceProgress.find(p => p.id === horse.id)?.position || 0) / 1200) * 100)
                      }))
                      .sort((a, b) => b.currentPosition - a.currentPosition)
                      .map((horse, index) => (
                        <div key={horse.id} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-md px-2 py-1 shadow-sm min-w-0 flex-1">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs ${
                            index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black' :
                            index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-500 text-black' :
                            index === 2 ? 'bg-gradient-to-r from-amber-600 to-amber-800 text-white' :
                            'bg-gradient-to-r from-slate-600 to-slate-800 text-white'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs text-white truncate">{horse.name}</div>
                            <div className="text-xs text-amber-300">{horse.metres}m / 1200m</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Race Results */}
            {raceState === "finished" && raceResults.length > 0 && (
              <div className="flex-shrink-0 mt-4">
                <RaceResults
                  results={raceResults}
                  onNewRace={handleNewRace}
                  autoCloseTimer={autoCloseTimer}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}