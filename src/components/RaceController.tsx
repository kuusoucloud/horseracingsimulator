declare global {
  interface Window {
    finishLineDetector?: {
      recordFinish: (horseId: string, horseName: string, finishTime: number) => void;
      reset?: () => void;
    };
    raceControllerVisualFinish?: (horseId: string, finishTime: number) => void;
  }
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, RotateCcw, Timer } from "lucide-react";
import { Horse, RaceProgress, RaceResult, RaceState } from "@/types/horse";

interface RaceControllerProps {
  horses: Horse[];
  onRaceProgress?: (progress: Array<{
    id: string;
    name: string;
    position: number;
    speed: number;
  }>) => void;
  onRaceComplete?: (results: RaceResult[]) => void;
  onRaceStateChange?: (state: RaceState) => void;
  raceState: RaceState;
  autoStartTimer?: number;
  onVisualFinish?: (horseId: string, finishTime: number) => void;
  preRaceTimer?: number;
  countdownTimer?: number; // Add countdown timer prop
  raceTimer?: number; // Add race timer prop
}

export default function RaceController({
  horses,
  onRaceProgress,
  onRaceComplete,
  onRaceStateChange,
  raceState,
  autoStartTimer = 0,
  onVisualFinish,
  preRaceTimer = 0,
  countdownTimer = 0,
  raceTimer = 0
}: RaceControllerProps) {
  const [countdown, setCountdown] = useState(0);
  const [isRacing, setIsRacing] = useState(false);
  const [raceProgress, setRaceProgress] = useState<{ [key: string]: number }>({});
  const [raceResults, setRaceResults] = useState<Horse[]>([]);
  const [raceStartTime, setRaceStartTime] = useState<number>(0);
  const [raceTimer, setRaceTimer] = useState<number>(0);
  const [finishedHorsesRef, setFinishedHorsesRef] = useState<Set<string>>(new Set()); // Track finished horses
  const [visualFinishedHorses, setVisualFinishedHorses] = useState<Set<string>>(new Set()); // Track 3D horses that reached finish line

  // Handle race state changes from sync
  const handleRaceStateChange = (newState: RaceState) => {
    if (onRaceStateChange) {
      onRaceStateChange(newState);
    }
    
    // Update synced state if this client initiated the change
    if (typeof window !== 'undefined') {
      // Only update if we're the active client (simple check)
      const isActiveClient = sessionStorage.getItem('raceActiveClient') === 'true';
      if (isActiveClient) {
        // This would be handled by the parent component's updateRaceState
      }
    }
  };

  // Initialize race progress when horses change
  useEffect(() => {
    if (!horses || horses.length === 0) return;
    
    const initialProgress: { [key: string]: number } = {};
    horses.forEach(horse => {
      initialProgress[horse.id] = 0;
    });
    setRaceProgress(initialProgress);
    
    // Only call onRaceProgress if it exists and is a function
    if (onRaceProgress && typeof onRaceProgress === 'function') {
      const initialProgressArray = horses.map(horse => ({
        id: horse.id,
        name: horse.name,
        position: 0,
        speed: 0,
        horse: horse
      }));
      onRaceProgress(initialProgressArray);
    }
    
    console.log("Initialized horses at position 0");
  }, [horses]);

  // Handle race state changes from parent
  useEffect(() => {
    console.log("Race state changed to:", raceState);
    if (raceState === "countdown") {
      setCountdown(10);
      setIsRacing(false);
      setFinishedHorsesRef(new Set());
      setVisualFinishedHorses(new Set());
    } else if (raceState === "racing") {
      console.log("Setting isRacing to true because raceState is racing");
      setIsRacing(true);
      setCountdown(0);
      setRaceStartTime(performance.now());
      setRaceTimer(0);
      setFinishedHorsesRef(new Set());
      setVisualFinishedHorses(new Set());
    } else if (raceState === "pre-race" || raceState === "finished") {
      setIsRacing(false);
      setCountdown(0);
    }
  }, [raceState]);

  // Update countdown from synced data
  useEffect(() => {
    if (raceState === "countdown" && typeof countdownTimer === 'number') {
      setCountdown(countdownTimer);
    }
  }, [countdownTimer, raceState]);

  // Countdown effect - transitions to racing when countdown reaches 0
  useEffect(() => {
    if (countdown > 0 && raceState === "countdown") {
      const timer = setTimeout(() => {
        const newCountdown = countdown - 1;
        setCountdown(newCountdown);
        
        // When countdown reaches 0, start the race
        if (newCountdown === 0) {
          console.log("Countdown finished, starting race!");
          if (onRaceStateChange) {
            onRaceStateChange("racing");
          }
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, raceState, onRaceStateChange]);

  // Race simulation effect
  useEffect(() => {
    // Only start race simulation when racing state is active
    if (!isRacing || !horses || horses.length === 0 || raceState !== "racing") {
      console.log("Race simulation NOT starting:", { isRacing, horsesLength: horses?.length || 0, raceState });
      return;
    }
    
    console.log("Starting race simulation!", { isRacing, raceState, countdown });

    const raceInterval = setInterval(() => {
      const currentTime = performance.now();
      const elapsedTime = (currentTime - raceStartTime) / 1000; // Convert to seconds
      setRaceTimer(elapsedTime);
      
      setRaceProgress(prevProgress => {
        const newProgress = { ...prevProgress };
        let raceFinished = false;
        const finishedHorses: Array<{ horse: Horse; finishTime: number; finalPosition: number }> = [];

        // Calculate race progress percentage for pack racing logic
        const averagePosition = Object.values(prevProgress).reduce((sum, pos) => sum + pos, 0) / horses.length;
        const raceProgressPercent = (averagePosition / 1200) * 100;

        horses.forEach((horse, horseIndex) => {
          const currentPosition = newProgress[horse.id] || 0;
          const currentPercent = (currentPosition / 1200) * 100;
          
          // BASE SPEED CALCULATION - PRIMARILY BASED ON ELO
          const horseELO = horse.elo || 1200; // Default ELO if not set
          
          // Convert ELO to base speed (higher ELO = faster base speed)
          // ELO range: 400-2100, Speed range: 0.5-3.0
          const eloNormalized = Math.max(0, Math.min(1, (horseELO - 400) / 1700)); // Normalize ELO to 0-1
          
          // Add small random variation (±10%) to prevent completely predictable races
          const randomVariation = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
          
          let speedMultiplier = randomVariation;
          let finalSpeed = 0;
          let newPosition = currentPosition;
          
          // PACK RACING PHASE (0% - 40%)
          if (raceProgressPercent < 40) {
            // Gentler pack racing - allow more natural spreading
            const packLeaderPosition = Math.max(...Object.values(newProgress));
            const packTrailerPosition = Math.min(...Object.values(newProgress));
            const packSpread = packLeaderPosition - packTrailerPosition;

            // Allow wider pack spread (increased from 35 to 50 meters)
            const maxPackSpread = 50; // Increased pack spread
            const packCenter = (packLeaderPosition + packTrailerPosition) / 2;

            // Assign random but consistent position within pack
            const packSeed = (horseIndex * 17 + horse.name.length * 7) % 100;
            const packPositionRatio = packSeed / 100;

            const targetPosition = packCenter + ((packPositionRatio - 0.5) * maxPackSpread);

            // Very gentle correction to maintain loose pack position
            const distanceFromTarget = targetPosition - currentPosition;
            if (Math.abs(distanceFromTarget) > 30) { // Increased threshold from 20 to 30
              speedMultiplier = distanceFromTarget > 0 ? 1.05 : 0.95; // Much gentler correction (was 1.1/0.9)
            } else {
              speedMultiplier = 0.8 + (Math.random() * 0.4); // Even more variation when in position (0.8-1.2)
            }

            // Faster pack racing base speed with more randomness
            const packBaseSpeed = 0.75 + (Math.sin(Date.now() / 5000) * 0.1) + (Math.random() * 0.15); // More random
            finalSpeed = packBaseSpeed * speedMultiplier;
            newPosition = Math.min(currentPosition + finalSpeed * 2.0, 1200); // Faster movement
          }
          // GRADUAL TRANSITION PHASE (40% - 60%)
          else if (raceProgressPercent < 60) {
            // Gradual transition from pack to individual performance
            const transitionProgress = (raceProgressPercent - 40) / 20; // 0 to 1 over 20%

            // Blend pack racing with ELO-based performance
            const packInfluence = 1 - transitionProgress; // 1 to 0
            const eloInfluence = transitionProgress; // 0 to 1

            // Pack component (diminishing) with more randomness
            const packSpeed = 0.85 + (Math.random() * 0.3); // More random (0.85-1.15)

            // ELO component with more randomness (increased from 0.08 to 0.12)
            const eloSpeedBonus = 1.0 + (eloNormalized * 0.12); // Moderate ELO influence
            const randomFactor = 0.8 + (Math.random() * 0.4); // Moderate randomness (0.8-1.2x)

            // Blend the two influences with randomness
            speedMultiplier = ((packSpeed * packInfluence) + (eloSpeedBonus * eloInfluence)) * randomFactor;

            // Faster transition speed with randomness
            const transitionBaseSpeed = 0.85 + (transitionProgress * 0.5) + (Math.random() * 0.12); // Moderate random
            finalSpeed = transitionBaseSpeed * speedMultiplier;
            newPosition = Math.min(currentPosition + finalSpeed * 2.5, 1200); // Faster
          }
          // SPRINT PHASE (60% - 100%)
          else {
            // Now ELO matters but with more randomness for closer races
            const sprintProgress = (raceProgressPercent - 60) / 40; // 0 to 1 over final 40%

            // Sprint effectiveness based on ELO (increased from 0.12 to 0.18)
            const sprintBonus = 1.05 + (eloNormalized * 0.18); // Moderate sprint bonus
            const randomSprintFactor = 0.75 + (Math.random() * 0.5); // Good randomness (0.75-1.25x)
            speedMultiplier *= sprintBonus * randomSprintFactor;

            // Stamina effect - higher ELO horses maintain speed better (increased from 0.15 to 0.22)
            const fatigueResistance = 0.5 + (eloNormalized * 0.22); // Moderate fatigue resistance
            const fatigueEffect = Math.max(0.65, fatigueResistance * (1 - sprintProgress * 0.35)); // Balanced fatigue
            const fatigueRandomness = 0.9 + (Math.random() * 0.2); // Moderate fatigue randomness
            speedMultiplier *= fatigueEffect * fatigueRandomness;

            // Final stretch boost (90%+) with more randomness
            if (currentPercent >= 90) {
              const finalStretchBoost = 1.0 + (eloNormalized * 0.12); // Increased from 0.08 to 0.12
              const finalRandomFactor = 0.8 + (Math.random() * 0.4); // Moderate final randomness (0.8-1.2)
              speedMultiplier *= finalStretchBoost * finalRandomFactor;
            }

            // Add surge/fade moments randomly (reduced frequency)
            const surgeChance = Math.random();
            if (surgeChance < 0.06) { // 6% chance of surge (reduced from 8%)
              speedMultiplier *= 1.35; // Moderate burst (reduced from 1.4)
            } else if (surgeChance > 0.94) { // 6% chance of fade (reduced from 8%)
              speedMultiplier *= 0.65; // Moderate slowdown (increased from 0.6)
            }

            // Faster sprint base speed with randomness
            const sprintBaseSpeed = 1.05 + (sprintProgress * 0.5) + (Math.random() * 0.12); // Moderate random
            finalSpeed = sprintBaseSpeed * speedMultiplier;
            newPosition = Math.min(currentPosition + finalSpeed * 3.0, 1200); // Fast sprint
          }
          
          // Update position
          newProgress[horse.id] = newPosition;
          
          // Check if horse finished - use Set to track and prevent duplicates
          if (newPosition >= 1200 && !finishedHorsesRef.has(horse.id)) {
            // Calculate precise finish time with multiple precision factors
            const previousPosition = currentPosition;
            const distanceCovered = newPosition - previousPosition;
            const distanceToFinish = 1200 - previousPosition;
            
            // Calculate what fraction of this tick was needed to reach finish line
            const fractionToFinish = Math.max(0, Math.min(1, distanceToFinish / Math.max(0.1, distanceCovered)));
            const tickDuration = 0.1; // 100ms tick
            const timeIntoTick = fractionToFinish * tickDuration;
            
            // Create unique finish time with multiple factors for uniqueness
            const baseFinishTime = elapsedTime - tickDuration + timeIntoTick;
            
            // Add multiple uniqueness factors to ensure no identical times
            const horseUniqueOffset = horseIndex * 0.0001; // Smaller base offset
            const speedBasedOffset = (finalSpeed % 1) * 0.0001; // Based on speed decimal
            const positionBasedOffset = ((newPosition * 1000) % 10) * 0.00001; // Based on position precision
            const randomMicroOffset = Math.random() * 0.00001; // Tiny random component
            
            const preciseFinishTime = baseFinishTime + horseUniqueOffset + speedBasedOffset + positionBasedOffset + randomMicroOffset;
            
            finishedHorses.push({
              horse,
              finishTime: Math.max(0.1, preciseFinishTime),
              finalPosition: newPosition
            });
            
            // Add to finished set to prevent re-adding
            setFinishedHorsesRef(prev => {
              const newSet = new Set(prev);
              newSet.add(horse.id);
              return newSet;
            });
            
            console.log(`${horse.name} finished at ${preciseFinishTime.toFixed(6)}s (previous: ${previousPosition.toFixed(1)}m, new: ${newPosition.toFixed(1)}m, fraction: ${fractionToFinish.toFixed(4)})`);
            
            // Notify parent when 3D horse finishes
            if (onVisualFinish && horse.id) {
              onVisualFinish(horse.id, preciseFinishTime);
            }
          }
        });

        // Update parent with progress - only if callback exists and is a function
        if (onRaceProgress && typeof onRaceProgress === 'function') {
          const progressArray = horses.map(horse => ({
            id: horse.id,
            name: horse.name,
            position: newProgress[horse.id] || 0,
            speed: 0,
            horse: horse
          }));
          onRaceProgress(progressArray);
        }

        // Race ending is now handled entirely by the 3D finish line detector
        // This simulation continues to run for visual purposes only
        // The race will end when all horses cross the extended finish line in 3D

        return newProgress;
      });
    }, 100); // Update every 100ms for smooth animation

    return () => clearInterval(raceInterval);
  }, [isRacing, countdown, horses, onRaceProgress, onRaceComplete]);

  // Create finish line detector system - initialize when horses are available
  useEffect(() => {
    // Only create if we have horses and don't have a detector already
    if (!horses || horses.length === 0) {
      console.log("⏳ Waiting for horses to be available...");
      return;
    }

    console.log("🏁 Creating finish line detector for", horses.length, "horses");

    const finishLineDetector = {
      finishedHorses: [] as Array<{ id: string; name: string; position: number; finishTime: number }>,
      allHorsesFinished: false,
      totalHorses: horses.length, // Store the horse count
      recordFinish: (horseId: string, horseName: string, finishTime: number) => {
        // Check if horse already finished
        if (finishLineDetector.finishedHorses.find(h => h.id === horseId)) {
          console.log(`${horseName} already finished, ignoring duplicate`);
          return;
        }
        
        // Add horse to finished list
        const position = finishLineDetector.finishedHorses.length + 1;
        finishLineDetector.finishedHorses.push({
          id: horseId,
          name: horseName,
          position,
          finishTime
        });
        
        console.log(`🏁 ${horseName} finished in position ${position} at ${finishTime.toFixed(3)}s`);
        console.log(`📊 Finished horses: ${finishLineDetector.finishedHorses.length}/${finishLineDetector.totalHorses}`);
        
        // Check if all horses have finished
        if (finishLineDetector.finishedHorses.length >= finishLineDetector.totalHorses && !finishLineDetector.allHorsesFinished) {
          finishLineDetector.allHorsesFinished = true;
          console.log("🎉 ALL HORSES FINISHED! Triggering race results...");
          
          // Create race results based on actual 3D finish order
          const finishedHorses = finishLineDetector.finishedHorses.slice(); // Copy array
          const raceResults = horses.map(horse => {
            const finishData = finishedHorses.find(f => f.id === horse.id);
            return {
              id: horse.id, // Add required id field
              horse: horse, // Include full horse object
              name: horse.name, // Ensure name is included
              position: finishData ? finishData.position : horses.length, // Fallback placement
              placement: finishData ? finishData.position : horses.length, // Fallback placement
              finishTime: finishData ? finishData.finishTime : 25 + Math.random() * 5, // Fallback time
              lane: horse.lane, // Add required lane field
              odds: horse.odds, // Add required odds field
              gap: finishData && finishData.position > 1 ? 
                `+${(finishData.finishTime - finishedHorses[0].finishTime).toFixed(3)}s` : 
                "Winner", // Calculate gap from winner
              finalPosition: 1200 // All horses that finish get full distance
            };
          }).sort((a, b) => a.placement - b.placement);
          
          console.log("🏆 Race Results:", raceResults);
          
          // End the race with actual results
          setIsRacing(false);
          if (onRaceComplete) {
            console.log("📞 Calling onRaceComplete...");
            
            // Remove the ELO update from here - it will be handled in RaceResults
            // updateEloRatings(raceResults);
            
            onRaceComplete(raceResults as RaceResult[]);
          } else {
            console.error("❌ onRaceComplete is not defined!");
          }
        }
      },
      reset: () => {
        console.log("🔄 Resetting finish line detector");
        finishLineDetector.finishedHorses = [];
        finishLineDetector.allHorsesFinished = false;
      }
    };
    
    // Make it globally available
    window.finishLineDetector = finishLineDetector;
    console.log("✅ Finish line detector initialized for", horses.length, "horses");
    
    return () => {
      console.log("🧹 Cleaning up finish line detector");
      delete window.finishLineDetector;
    };
  }, [horses]);

  // Reset finish line detector when race starts
  useEffect(() => {
    if (isRacing && window.finishLineDetector && window.finishLineDetector.reset) {
      window.finishLineDetector.reset();
    }
  }, [isRacing]);

  // Callback for when 3D horses visually finish
  const handleVisualFinish = useCallback((horseId: string, finishTime: number) => {
    setVisualFinishedHorses(prev => {
      const newSet = new Set(prev);
      if (!newSet.has(horseId)) {
        newSet.add(horseId);
        console.log(`3D Horse ${horseId} visually finished at ${finishTime.toFixed(3)}s`);
      }
      return newSet;
    });
  }, []);

  // Expose the visual finish callback to parent
  useEffect(() => {
    if (onVisualFinish) {
      // This will be called by RaceTrack when horses visually cross finish line
      window.raceControllerVisualFinish = handleVisualFinish;
    }
    return () => {
      delete window.raceControllerVisualFinish;
    };
  }, [handleVisualFinish, onVisualFinish]);

  const startRace = () => {
    console.log("Start Race button clicked!");
    
    // Reset race progress to 0 for all horses
    if (horses && horses.length > 0) {
      const initialProgress: { [key: string]: number } = {};
      horses.forEach(horse => {
        initialProgress[horse.id] = 0;
      });
      setRaceProgress(initialProgress);
      
      // Only call onRaceProgress if it exists and is a function
      if (onRaceProgress && typeof onRaceProgress === 'function') {
        const initialProgressArray = horses.map(horse => ({
          id: horse.id,
          name: horse.name,
          position: 0,
          speed: 0,
          horse: horse
        }));
        onRaceProgress(initialProgressArray);
      }
    }
    
    // Call parent's state change function
    if (onRaceStateChange) {
      console.log("Calling parent onRaceStateChange");
      onRaceStateChange("countdown");
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
      
      // Only call onRaceProgress if it exists and is a function
      if (onRaceProgress && typeof onRaceProgress === 'function') {
        const initialProgressArray = horses.map(horse => ({
          id: horse.id,
          name: horse.name,
          position: 0,
          speed: 0,
          horse: horse
        }));
        onRaceProgress(initialProgressArray);
      }
    }
  };

  return (
    <div className="w-full h-full min-h-[200px] relative overflow-hidden">
      {/* Glassmorphism container */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl">
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-green-500/10 rounded-xl" />
        
        {/* Glow effects */}
        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-green-500/20 to-emerald-500/20 rounded-xl blur-xl opacity-50" />
      </div>
      
      <div className="relative z-10 p-4 h-full flex flex-col items-center justify-center space-y-4">
        <div className="text-center">
          <div className={`px-4 py-3 rounded-lg font-bold text-sm transition-all duration-300 w-full ${
            raceState === "pre-race" && preRaceTimer === 0
              ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
              : "bg-gray-400 text-gray-700"
          }`}>
            {raceState === "pre-race" && preRaceTimer > 0
              ? `⏱️ Starting in ${preRaceTimer}s`
              : raceState === "pre-race" 
              ? "🏇 Race Starting..." 
              : raceState === "countdown" 
              ? "🏁 Starting..." 
              : raceState === "racing" 
              ? "🏇 Racing" 
              : "🏆 Finished"
            }
          </div>
          
          {preRaceTimer > 0 && raceState === "pre-race" && (
            <div className="text-4xl font-bold text-white animate-pulse bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mt-3">
              {preRaceTimer}
            </div>
          )}
          
          {countdown > 0 && raceState === "countdown" && (
            <div className="text-3xl font-bold text-white animate-pulse bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent mt-3">
              {countdown}
            </div>
          )}
          
          {isRacing && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                Race in Progress
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}