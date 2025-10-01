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
}

export default function RaceController({
  horses,
  raceState,
  preRaceTimer = 0,
  countdownTimer = 0,
  raceTimer = 0
}: RaceControllerProps) {
  // Client-side timer for smooth countdown
  const [clientTimer, setClientTimer] = useState(preRaceTimer);
  const [clientCountdown, setClientCountdown] = useState(countdownTimer);
  const lastServerTimer = useRef(preRaceTimer);
  const lastServerCountdown = useRef(countdownTimer);
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
        
        console.log(`🏁 Current 3D finish order:`, finishLineResults.current);
        
        // If we have top 3 finishers, trigger photo finish
        if (finishLineResults.current.length >= 3) {
          console.log('📸 Top 3 horses finished, triggering photo finish...');
          
          // Get top 3 for photo finish
          const top3 = finishLineResults.current.slice(0, 3);
          
          // Update race state with real 3D detector results
          if (supabase) {
            supabase
              .from('race_state')
              .update({
                race_state: 'finished',
                show_photo_finish: true,
                show_results: true,
                race_results: top3.map(r => ({
                  id: r.horseId,
                  name: r.horseName,
                  placement: r.placement,
                  finishTime: r.finishTime
                })),
                photo_finish_results: top3.map(r => ({
                  id: r.horseId,
                  name: r.horseName,
                  placement: r.placement,
                  finishTime: r.finishTime
                }))
              })
              .eq('id', syncedData?.id)
              .then(({ error }) => {
                if (error) {
                  console.error('❌ Error updating race with 3D results:', error);
                } else {
                  console.log('✅ Race updated with real 3D finish line results!');
                }
              });
          }
        }
      },
      reset: () => {
        console.log('🔄 Resetting 3D finish line detector');
        finishLineResults.current = [];
      }
    };
    
    console.log('✅ 3D finish line detector initialized');
  }, [syncedData?.id]);

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

  // Display timer based on race state
  const getTimerDisplay = () => {
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
    if (raceState === "pre-race" && clientTimer > 0) {
      return clientTimer;
    } else if (raceState === "countdown" && clientCountdown > 0) {
      return clientCountdown;
    }
    return null;
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
            raceState === "pre-race" && clientTimer === 0
              ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
              : "bg-gray-400 text-gray-700"
          }`}>
            {getTimerDisplay()}
          </div>
          
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
          
          {raceState === "racing" && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                Race Time: {raceTimer}s
              </div>
            </div>
          )}

          {raceState === "finished" && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-white bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                Race Complete!
              </div>
            </div>
          )}
        </div>

        {/* Timer status indicator */}
        <div className="text-center">
          <div className="text-xs text-white/70 bg-gradient-to-r from-green-400/20 to-blue-400/20 px-3 py-1 rounded-full border border-white/10">
            {raceState === "pre-race" || raceState === "countdown" 
              ? "⏰ Client Timer (Synced with Server)"
              : "🖥️ Server Controlled"
            }
          </div>
        </div>
      </div>
    </div>
  );
}