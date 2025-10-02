"use client";

import React, { useState, useEffect, useRef } from "react";
import { Horse, RaceState } from "@/types/horse";
import { supabase } from '@/lib/supabase';

interface RaceControllerProps {
  horses: Horse[];
  onRaceProgress?: () => void;
  onRaceComplete?: () => void;
  onRaceStateChange?: () => void;
  raceState: RaceState;
  preRaceTimer?: number;
  countdownTimer?: number;
  raceTimer?: number;
  isWaitingForNewRace?: boolean; // Add prop for mid-race blocking
}

export default function RaceController({
  horses,
  onRaceProgress,
  onRaceComplete,
  onRaceStateChange,
  raceState,
  preRaceTimer,
  countdownTimer,
  raceTimer,
  isWaitingForNewRace
}: RaceControllerProps) {
  // Client-side timer for smooth countdown
  const [clientTimer, setClientTimer] = useState(0);
  const [clientCountdown, setClientCountdown] = useState(0);
  const lastServerTimer = useRef(0);
  const lastServerCountdown = useRef(0);
  const clientInterval = useRef<NodeJS.Timeout | null>(null);

  // 3D Finish Line Detector System
  const finishLineResults = useRef<Array<{
    horseId: string;
    horseName: string;
    finishTime: number;
    placement?: number;
  }>>([]);

  // Manual race start function
  const startNewRace = async () => {
    if (!supabase) return;
    
    try {
      console.log('🏇 Starting new race manually...');
      const { error } = await supabase.rpc('manual_start_new_race');
      
      if (error) {
        console.error('❌ Error starting new race:', error);
      } else {
        console.log('✅ New race started successfully!');
      }
    } catch (error) {
      console.error('❌ Error calling start new race:', error);
    }
  };

  // Add manual race creation for testing
  const handleManualNewRace = async () => {
    if (!supabase) return;
    
    console.log('🔧 Manually triggering new race creation...');
    try {
      const { data, error } = await supabase.functions.invoke('supabase-functions-race-server', {
        body: { action: 'force_new_race' }
      });
      
      if (error) {
        console.error('❌ Manual race creation error:', error);
      } else {
        console.log('✅ Manual race creation result:', data);
      }
    } catch (error) {
      console.error('❌ Manual race creation failed:', error);
    }
  };

  // Initialize finish line detector
  useEffect(() => {
    console.log('🏁 Initializing 3D finish line detector...');
    
    // Reset finish line detector when race starts
    if (window.finishLineDetector) {
      window.finishLineDetector.reset?.();
    }
    
    window.finishLineDetector = {
      recordFinish: (horseId: string, horseName: string, finishTime: number) => {
        console.log(`🏁 3D Detector: ${horseName} finished at ${finishTime.toFixed(3)}s`);
        
        // Check if this horse already finished (prevent duplicates)
        const existingFinish = finishLineResults.current.find(r => r.horseId === horseId);
        if (existingFinish) {
          console.log(`⚠️ Horse ${horseName} already recorded, ignoring duplicate`);
          return;
        }
        
        // Record the finish
        finishLineResults.current.push({
          horseId,
          horseName,
          finishTime,
        });
        
        // Sort by finish time and assign placements
        finishLineResults.current.sort((a, b) => a.finishTime - b.finishTime);
        finishLineResults.current.forEach((result, index) => {
          result.placement = index + 1;
        });
        
        console.log(`🏁 Current 3D finish order (${finishLineResults.current.length}/8):`, finishLineResults.current);
        
        // WAIT FOR ALL 8 HORSES TO FINISH before ending race
        if (finishLineResults.current.length >= 8) {
          console.log('🏆 ALL 8 horses finished! Triggering race completion...');
          
          // Get all results for complete race finish
          const allResults = finishLineResults.current;
          
          // Update race state with complete 3D detector results
          if (supabase) {
            // Get the current race ID from the database
            supabase
              .from('race_state')
              .select('id')
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
              .then(({ data: currentRace, error: fetchError }) => {
                if (fetchError || !currentRace || !supabase) {
                  console.error('❌ Error fetching current race:', fetchError);
                  return;
                }

                // Update the current race with complete 3D detector results
                return supabase
                  .from('race_state')
                  .update({
                    race_state: 'finished',
                    show_photo_finish: true,
                    show_results: true,
                    race_results: allResults.map(r => ({
                      id: r.horseId,
                      name: r.horseName,
                      placement: r.placement,
                      finishTime: r.finishTime
                    })),
                    photo_finish_results: allResults.slice(0, 3).map(r => ({
                      id: r.horseId,
                      name: r.horseName,
                      placement: r.placement,
                      finishTime: r.finishTime
                    }))
                  })
                  .eq('id', currentRace.id);
              })
              .then((result) => {
                if (result?.error) {
                  console.error('❌ Error updating race with 3D results:', result.error);
                } else {
                  console.log('✅ Race updated with complete 3D finish line results!');
                }
              });
          }
        } else {
          console.log(`⏳ Waiting for more horses to finish (${finishLineResults.current.length}/8 finished)`);
        }
      },
      reset: () => {
        console.log('🔄 Resetting 3D finish line detector');
        finishLineResults.current = [];
      }
    };
    
    console.log('✅ 3D finish line detector initialized');
  }, []);

  // Reset detector when new race starts
  useEffect(() => {
    if (raceState === 'pre-race' || raceState === 'countdown') {
      console.log('🔄 New race starting, resetting 3D detector');
      finishLineResults.current = [];
      if (window.finishLineDetector?.reset) {
        window.finishLineDetector.reset();
      }
    }
  }, [raceState]);

  // Sync with server timer when it changes
  useEffect(() => {
    if (preRaceTimer !== lastServerTimer.current) {
      console.log(`⏰ Server timer update: ${preRaceTimer}`);
      setClientTimer(preRaceTimer);
      lastServerTimer.current = preRaceTimer;
    }
  }, [preRaceTimer]);

  useEffect(() => {
    if (countdownTimer !== lastServerCountdown.current) {
      console.log(`⏰ Server countdown update: ${countdownTimer}`);
      setClientCountdown(countdownTimer);
      lastServerCountdown.current = countdownTimer;
    }
  }, [countdownTimer]);

  // Client-side countdown for smooth updates
  useEffect(() => {
    if (clientInterval.current) {
      clearInterval(clientInterval.current);
    }

    if (raceState === "pre-race" && clientTimer > 0) {
      clientInterval.current = setInterval(() => {
        setClientTimer(prev => {
          if (prev <= 1) {
            clearInterval(clientInterval.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (raceState === "countdown" && clientCountdown > 0) {
      clientInterval.current = setInterval(() => {
        setClientCountdown(prev => {
          if (prev <= 1) {
            clearInterval(clientInterval.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (clientInterval.current) {
        clearInterval(clientInterval.current);
      }
    };
  }, [raceState, clientTimer, clientCountdown]);

  // Display timer based on race state and waiting status
  const getTimerDisplay = () => {
    if (isWaitingForNewRace) {
      return "🚫 Race in Progress - Waiting for Next Race";
    }
    
    if (raceState === "pre-race" && clientTimer > 0) {
      return `⏱️ Starting in ${clientTimer}s`;
    } else if (raceState === "pre-race") {
      return "🏇 Race Starting...";
    } else if (raceState === "countdown") {
      return `🏁 Starting in ${clientCountdown}s`;
    } else if (raceState === "racing") {
      return "🏇 Racing";
    } else {
      return "🏆 Finished";
    }
  };

  const getTimerNumber = () => {
    if (isWaitingForNewRace) {
      return null; // No countdown when waiting
    }
    
    if (raceState === "pre-race" && clientTimer > 0) {
      return clientTimer;
    } else if (raceState === "countdown" && clientCountdown > 0) {
      return clientCountdown;
    }
    return null;
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg">
      {/* Glassmorphism container */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl">
        {/* Animated gradient overlay - red tint when waiting */}
        <div className={`absolute inset-0 rounded-xl ${
          isWaitingForNewRace 
            ? "bg-gradient-to-br from-red-500/20 via-orange-500/10 to-yellow-500/10" 
            : "bg-gradient-to-br from-amber-500/10 via-transparent to-green-500/10"
        }`} />
        
        {/* Glow effects - red when waiting */}
        <div className={`absolute -inset-1 rounded-xl blur-xl opacity-50 ${
          isWaitingForNewRace
            ? "bg-gradient-to-r from-red-500/30 via-orange-500/20 to-yellow-500/20"
            : "bg-gradient-to-r from-amber-500/20 via-green-500/20 to-emerald-500/20"
        }`} />
      </div>
      
      <div className="relative z-10 p-4 h-full flex flex-col items-center justify-center space-y-4">
        <div className="text-center">
          <div className={`px-4 py-3 rounded-lg font-bold text-sm transition-all duration-300 w-full ${
            isWaitingForNewRace
              ? "bg-gradient-to-r from-red-500 to-orange-600 text-white shadow-lg animate-pulse"
              : raceState === "pre-race" && clientTimer === 0
                ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
                : "bg-gray-400 text-gray-700"
          }`}>
            {getTimerDisplay()}
          </div>
          
          {/* Mid-race blocking message */}
          {isWaitingForNewRace && (
            <div className="mt-3 space-y-2">
              <div className="text-lg font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent animate-pulse">
                ⏳ Please Wait
              </div>
              <div className="text-xs text-white/80 bg-red-500/20 px-3 py-2 rounded-lg border border-red-400/30">
                You connected during an active race. You'll be able to participate in the next race.
              </div>
              <div className="text-xs text-white/60">
                Races run continuously - the next one will start soon!
              </div>
            </div>
          )}
          
          {/* Client-side smooth timer displays */}
          {getTimerNumber() && (
            <div className={`text-4xl font-bold animate-pulse mt-3 ${
              raceState === "pre-race" 
                ? "bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
                : "bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent"
            }`}>
              {getTimerNumber()}
            </div>
          )}
          
          {raceState === "racing" && !isWaitingForNewRace && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                Race Time: {raceTimer}s
              </div>
            </div>
          )}

          {raceState === "finished" && !isWaitingForNewRace && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold text-white bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                Race Complete!
              </div>
            </div>
          )}
        </div>

        {/* Timer status indicator */}
        <div className="text-center">
          <div className={`text-xs px-3 py-1 rounded-full border ${
            isWaitingForNewRace
              ? "text-red-300 bg-gradient-to-r from-red-400/20 to-orange-400/20 border-red-400/30"
              : "text-white/70 bg-gradient-to-r from-green-400/20 to-blue-400/20 border-white/10"
          }`}>
            {isWaitingForNewRace
              ? "🚫 Mid-Race Connection Blocked"
              : raceState === "pre-race" || raceState === "countdown" 
                ? "⏰ Client Timer (Synced with Server)"
                : "🖥️ Server Controlled"
            }
          </div>
        </div>
      </div>

      {/* Add manual trigger button for testing */}
      {raceState === 'finished' && (
        <div className="mt-4 p-2 bg-yellow-100 rounded">
          <p className="text-sm text-yellow-800 mb-2">
            Race finished - waiting for automatic new race creation...
          </p>
          <button
            onClick={handleManualNewRace}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            🔧 Force New Race (Test)
          </button>
        </div>
      )}
    </div>
  );
}