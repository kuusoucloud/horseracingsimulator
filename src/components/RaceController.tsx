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
  resultsCountdown?: number; // Add results countdown prop
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
  resultsCountdown, // Add results countdown parameter
  isWaitingForNewRace
}: RaceControllerProps) {
  // Client-side timer for smooth countdown
  const [clientTimer, setClientTimer] = useState(0);
  const [clientCountdown, setClientCountdown] = useState(0);
  const [clientResultsCountdown, setClientResultsCountdown] = useState(0); // Add client results countdown
  const lastServerTimer = useRef(0);
  const lastServerCountdown = useRef(0);
  const lastServerResultsCountdown = useRef(0); // Add server results countdown ref
  const clientInterval = useRef<NodeJS.Timeout | null>(null);

  // 3D Finish Line Detector System
  const finishLineResults = useRef<Array<{
    horseId: string;
    horseName: string;
    finishTime: number;
    placement?: number;
  }>>([]);

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
    if (preRaceTimer !== undefined && preRaceTimer !== lastServerTimer.current) {
      console.log(`⏰ Server timer update: ${preRaceTimer}`);
      setClientTimer(preRaceTimer);
      lastServerTimer.current = preRaceTimer;
    }
  }, [preRaceTimer]);

  useEffect(() => {
    if (countdownTimer !== undefined && countdownTimer !== lastServerCountdown.current) {
      console.log(`⏰ Server countdown update: ${countdownTimer}`);
      setClientCountdown(countdownTimer);
      lastServerCountdown.current = countdownTimer;
    }
  }, [countdownTimer]);

  // Sync with server results countdown when it changes
  useEffect(() => {
    if (resultsCountdown !== undefined && resultsCountdown !== lastServerResultsCountdown.current) {
      console.log(`⏰ Server results countdown update: ${resultsCountdown}`);
      setClientResultsCountdown(resultsCountdown);
      lastServerResultsCountdown.current = resultsCountdown;
    }
  }, [resultsCountdown]);

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
    } else if (raceState === "finished" && clientResultsCountdown > 0) {
      // Add results countdown timer
      clientInterval.current = setInterval(() => {
        setClientResultsCountdown(prev => {
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
  }, [raceState, clientTimer, clientCountdown, clientResultsCountdown]);

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
    } else if (raceState === "finished" && clientResultsCountdown > 0) {
      return `🏆 New Race in ${clientResultsCountdown}s`;
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
    } else if (raceState === "finished" && clientResultsCountdown > 0) {
      return clientResultsCountdown; // Show results countdown
    }
    return null;
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg">
      <div className="p-4 h-full flex flex-col items-center justify-center space-y-4">
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
              <div className="text-xs text-gray-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                You connected during an active race. You'll be able to participate in the next race.
              </div>
              <div className="text-xs text-gray-500">
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
              <div className="text-xs font-semibold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                Race Time: {raceTimer}s
              </div>
            </div>
          )}

          {raceState === "finished" && !isWaitingForNewRace && (
            <div className="mt-3 space-y-2">
              {clientResultsCountdown > 0 ? (
                <div className="text-xs font-semibold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                  🏆 Next Race Starting Soon!
                </div>
              ) : (
                <div className="text-xs font-semibold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                  Race Complete!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timer status indicator */}
        <div className="text-center">
          <div className={`text-xs px-3 py-1 rounded-full border ${
            isWaitingForNewRace
              ? "text-red-600 bg-red-50 border-red-200"
              : "text-gray-600 bg-gray-100 border-gray-200"
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
    </div>
  );
}