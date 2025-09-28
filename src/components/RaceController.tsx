"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, RotateCcw, Timer } from "lucide-react";
import { Horse, RaceProgress, RaceResult, RaceState } from "@/types/horse";

interface RaceControllerProps {
  horses: Horse[];
  onRaceProgress: (progress: Array<{
    id: string;
    name: string;
    position: number;
    speed: number;
  }>) => void;
  onRaceComplete: (results: RaceResult[]) => void;
  onStartRace: () => void;
  raceState: RaceState;
  autoStartTimer?: number;
}

export default function RaceController({
  horses,
  onRaceProgress,
  onRaceComplete,
  onStartRace,
  raceState,
  autoStartTimer = 0
}: RaceControllerProps) {
  const [countdown, setCountdown] = useState(0);
  const [isRacing, setIsRacing] = useState(false);
  const [raceProgress, setRaceProgress] = useState<{ [key: string]: number }>({});
  const [raceResults, setRaceResults] = useState<Horse[]>([]);
  const [raceStartTime, setRaceStartTime] = useState<number>(0);

  // Initialize race progress when horses change
  useEffect(() => {
    if (!horses || horses.length === 0) return; // Safety check
    
    const initialProgress: { [key: string]: number } = {};
    horses.forEach(horse => {
      initialProgress[horse.id] = 0; // Ensure horses start at position 0
    });
    setRaceProgress(initialProgress);
    
    // Also immediately send this to parent so 3D horses appear at start line
    const initialProgressArray = horses.map(horse => ({
      id: horse.id,
      name: horse.name,
      position: 0, // Explicitly set to 0
      speed: 0,
      horse: horse // Include the full horse object to maintain lane info
    }));
    onRaceProgress(initialProgressArray);
    
    console.log("Initialized horses at position 0:", initialProgressArray);
  }, [horses]);

  // Handle race state changes from parent
  useEffect(() => {
    console.log("Race state changed to:", raceState);
    if (raceState === "countdown") {
      setCountdown(10);
      setIsRacing(false);
    } else if (raceState === "racing") {
      console.log("Setting isRacing to true because raceState is racing");
      setIsRacing(true);
      setCountdown(0);
      setRaceStartTime(Date.now()); // Set race start time when racing begins
    } else if (raceState === "pre-race" || raceState === "finished") {
      setIsRacing(false);
      setCountdown(0);
    }
  }, [raceState]);

  // Countdown effect - only for display, actual race start is controlled by parent
  useEffect(() => {
    if (countdown > 0 && raceState === "countdown") {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, raceState]);

  // Race simulation effect
  useEffect(() => {
    // Only start race simulation when racing state is active
    if (!isRacing || !horses || horses.length === 0) {
      console.log("Race simulation NOT starting:", { isRacing, horsesLength: horses?.length || 0 });
      return;
    }
    
    console.log("Starting race simulation!", { isRacing, raceState, countdown });

    const raceInterval = setInterval(() => {
      setRaceProgress(prevProgress => {
        const newProgress = { ...prevProgress };
        let raceFinished = false;
        const finishedHorses: Array<{ horse: Horse; finishTime: number; finalPosition: number }> = [];

        // Calculate race progress percentage for pack racing logic
        const averagePosition = Object.values(prevProgress).reduce((sum, pos) => sum + pos, 0) / horses.length;
        const raceProgressPercent = (averagePosition / 1200) * 100;

        horses.forEach(horse => {
          const currentPosition = newProgress[horse.id] || 0;
          const currentPercent = (currentPosition / 1200) * 100;
          
          // Calculate base speed based on horse attributes
          const baseSpeed = (horse.speed || 50) / 100;
          const stamina = (horse.stamina || 50) / 100;
          const acceleration = (horse.acceleration || 50) / 100;
          
          let speedMultiplier = 1;
          
          // PACK RACING PHASE (0% - 35%)
          if (raceProgressPercent < 35) {
            // Horses stay in pack formation with slight variations
            const packPosition = averagePosition;
            const maxDeviation = 50; // Maximum 50m deviation from pack
            
            // Determine horse's pack position (backmarker, middle, leader)
            const horseIndex = horses.findIndex(h => h.id === horse.id);
            const packPositionFactor = (horseIndex / (horses.length - 1)) - 0.5; // -0.5 to 0.5
            
            const targetPackPosition = packPosition + (packPositionFactor * maxDeviation);
            
            // Adjust speed to maintain pack position
            const distanceFromTarget = targetPackPosition - currentPosition;
            if (Math.abs(distanceFromTarget) > 10) {
              speedMultiplier = distanceFromTarget > 0 ? 1.2 : 0.8;
            }
            
            // Base pack speed with small random variation
            const randomFactor = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
            speedMultiplier *= randomFactor;
          }
          // SPRINT PHASE (35% - 100%)
          else {
            // Each horse has their own sprint start point between 35% and 75%
            const sprintStartPercent = 35 + (Math.random() * 40); // 35% to 75%
            
            if (currentPercent >= sprintStartPercent) {
              // Horse is in sprint mode - use full attributes
              const sprintBonus = 1.5 + (acceleration * 0.5); // 1.5x to 2x speed boost
              speedMultiplier = sprintBonus;
              
              // Add stamina effect - horses with better stamina maintain speed longer
              const fatigueEffect = Math.max(0.7, stamina * (1 - (currentPercent - sprintStartPercent) / 65));
              speedMultiplier *= fatigueEffect;
            } else {
              // Still in pack, waiting for sprint moment
              speedMultiplier = 0.8 + Math.random() * 0.4; // Slower, conserving energy
            }
            
            // Add final sprint randomness for excitement
            const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
            speedMultiplier *= randomFactor;
          }
          
          // Calculate final speed and position
          const finalSpeed = baseSpeed * speedMultiplier;
          const newPosition = Math.min(currentPosition + finalSpeed * 3, 1200);
          newProgress[horse.id] = newPosition;
          
          // Check if horse finished and record their exact finish details
          if (newPosition >= 1200 && !finishedHorses.find(h => h.horse.id === horse.id)) {
            const currentTime = Date.now();
            const raceTimeInSeconds = (currentTime - raceStartTime) / 1000; // Convert to seconds
            finishedHorses.push({
              horse,
              finishTime: raceTimeInSeconds, // Now in seconds, not timestamp
              finalPosition: newPosition
            });
          }
        });

        // Update parent with progress - include horse object to maintain lane info
        const progressArray = horses.map(horse => ({
          id: horse.id,
          name: horse.name,
          position: newProgress[horse.id] || 0,
          speed: 0,
          horse: horse // Include the full horse object to maintain lane info
        }));
        onRaceProgress(progressArray);

        // End race when at least 3 horses finish (or all horses if less than 3)
        const minFinishers = Math.min(3, horses.length);
        if (finishedHorses.length >= minFinishers) {
          raceFinished = true;
        }

        if (raceFinished) {
          setIsRacing(false);
          
          // Sort finished horses by finish time for accurate placement
          const sortedFinished = finishedHorses.sort((a, b) => a.finishTime - b.finishTime);
          
          // Create results with accurate placements
          const results = horses.map(horse => {
            const finishedHorse = sortedFinished.find(f => f.horse.id === horse.id);
            const placement = finishedHorse ? 
              sortedFinished.findIndex(f => f.horse.id === horse.id) + 1 : 
              horses.length; // Unfinished horses get last place
              
            return {
              ...horse,
              finalPosition: newProgress[horse.id] || 0,
              finishTime: finishedHorse?.finishTime || ((Date.now() - raceStartTime) / 1000) + 10, // DNF gets +10s penalty
              placement
            };
          }).sort((a, b) => a.placement - b.placement);

          if (onRaceComplete) {
            onRaceComplete(results as RaceResult[]);
          }
        }

        return newProgress;
      });
    }, 100); // Update every 100ms for smooth animation

    return () => clearInterval(raceInterval);
  }, [isRacing, countdown, horses, onRaceProgress, onRaceComplete]);

  const startRace = () => {
    console.log("Start Race button clicked!"); // Debug log
    
    // Reset race progress to 0 for all horses
    if (horses && horses.length > 0) {
      const initialProgress: { [key: string]: number } = {};
      horses.forEach(horse => {
        initialProgress[horse.id] = 0;
      });
      setRaceProgress(initialProgress);
      
      // Initialize race progress with all horses at position 0
      const initialProgressArray = horses.map(horse => ({
        id: horse.id,
        name: horse.name,
        position: 0,
        speed: 0,
        horse: horse // Include the full horse object to maintain lane info
      }));
      onRaceProgress(initialProgressArray);
    }
    
    // Call parent's start race function - this will trigger countdown
    if (onStartRace) {
      console.log("Calling parent onStartRace"); // Debug log
      onStartRace(); // This will set raceState to "countdown" in parent
    }
  };

  const resetRace = () => {
    setIsRacing(false);
    setCountdown(0);
    
    // Reset race progress to 0 for all horses
    if (horses && horses.length > 0) {
      const initialProgress: { [key: string]: number } = {};
      horses.forEach(horse => {
        initialProgress[horse.id] = 0;
      });
      setRaceProgress(initialProgress);
    }
  };

  return (
    <div className="w-full h-[100px] relative overflow-hidden">
      {/* Glassmorphism container */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl">
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-green-500/10 rounded-2xl" />
        
        {/* Glow effects */}
        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-green-500/20 to-emerald-500/20 rounded-2xl blur-xl opacity-50" />
      </div>
      
      <div className="relative z-10 p-4 h-full flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onStartRace}
            disabled={raceState !== "pre-race"}
            className={`px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 ${
              raceState === "pre-race"
                ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105"
                : "bg-gray-400 text-gray-700 cursor-not-allowed"
            }`}
          >
            {raceState === "pre-race" 
              ? `🏁 Start Race (Auto-start in ${autoStartTimer}s)` 
              : raceState === "countdown" 
              ? "🏁 Race Starting..." 
              : raceState === "racing" 
              ? "🏃‍♂️ Race in Progress" 
              : "🏆 Race Finished"
            }
          </button>
          
          {countdown > 0 && (
            <div className="text-4xl font-bold text-white animate-pulse bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              {countdown}
            </div>
          )}
          
          {isRacing && (
            <div className="flex items-center gap-2">
              <div className="text-lg font-semibold text-white bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                🏇 Racing in progress...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}