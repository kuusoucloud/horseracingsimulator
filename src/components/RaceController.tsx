"use client";

import React from "react";
import { Horse, RaceState } from "@/types/horse";

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
              ? `🏁 Starting in ${countdownTimer}s` 
              : raceState === "racing" 
              ? "🏇 Racing" 
              : "🏆 Finished"
            }
          </div>
          
          {/* Server-controlled timer displays */}
          {preRaceTimer > 0 && raceState === "pre-race" && (
            <div className="text-4xl font-bold text-white animate-pulse bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mt-3">
              {preRaceTimer}
            </div>
          )}
          
          {countdownTimer > 0 && raceState === "countdown" && (
            <div className="text-3xl font-bold text-white animate-pulse bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent mt-3">
              {countdownTimer}
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
              <div className="text-xs font-semibold text-white bg-gradient-to-r from-gold-400 to-yellow-400 bg-clip-text text-transparent">
                Race Complete!
              </div>
            </div>
          )}
        </div>

        {/* Server status indicator */}
        <div className="text-center">
          <div className="text-xs text-white/70 bg-gradient-to-r from-green-400/20 to-blue-400/20 px-3 py-1 rounded-full border border-white/10">
            🖥️ Server Controlled - All Timers Synced
          </div>
        </div>
      </div>
    </div>
  );
}