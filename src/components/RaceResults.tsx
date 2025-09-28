"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RaceResult } from "@/types/horse";

interface RaceResultsProps {
  results: RaceResult[];
  onNewRace: () => void;
  autoCloseTimer?: number;
}

export default function RaceResults({ results = [], onNewRace, autoCloseTimer = 0 }: RaceResultsProps) {
  const [showReplay, setShowReplay] = useState(false);

  // Safety check for results
  if (!results || results.length === 0) {
    return (
      <div className="w-full h-[400px] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl">
          <div className="relative z-10 p-6 h-full flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-cyan-400 mb-4">No Race Results</h2>
              <p className="text-cyan-300/80">Complete a race to see results here</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleReplay = () => {
    setShowReplay(true);
    onNewRace();
    // Hide replay after 3 seconds
    setTimeout(() => setShowReplay(false), autoCloseTimer);
  };

  const getPodiumEmoji = (placement: number) => {
    switch (placement) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return "🏇";
    }
  };

  const getPodiumGradient = (placement: number) => {
    switch (placement) {
      case 1: return "from-yellow-400 via-yellow-500 to-yellow-600";
      case 2: return "from-gray-300 via-gray-400 to-gray-500";
      case 3: return "from-amber-600 via-amber-700 to-amber-800";
      default: return "from-slate-600 via-slate-700 to-slate-800";
    }
  };

  return (
    <div className="w-full h-[400px] relative overflow-hidden">
      {/* Glassmorphism container */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl">
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 rounded-2xl" />
        
        {/* Glow effects */}
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur-xl opacity-50" />
      </div>
      
      <div className="relative z-10 p-6 h-full overflow-y-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-2">
            🏁 Race Results
          </h2>
          <p className="text-cyan-300/80">Final standings and race statistics</p>
        </motion.div>

        {/* Podium - Top 3 */}
        <motion.div
          className="grid grid-cols-3 gap-4 mb-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {results.slice(0, 3).map((horse, index) => (
            <motion.div
              key={horse.id}
              className={`bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center ${
                index === 0 ? 'transform scale-110' : ''
              }`}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
            >
              <div className={`text-6xl mb-2 ${index === 0 ? 'animate-bounce' : ''}`}>
                {getPodiumEmoji(horse.placement)}
              </div>
              <div className={`w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br ${getPodiumGradient(horse.placement)} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}>
                {horse.placement}
              </div>
              <h3 className="font-bold text-white text-lg mb-1">{horse.name}</h3>
              <div className="space-y-1">
                <Badge className="bg-cyan-500/20 border-cyan-400/50 text-cyan-300 text-xs">
                  {horse.finishTime?.toFixed(3)}s
                </Badge>
                <div className="text-emerald-300 text-sm font-semibold">
                  {horse.odds.toFixed(2)}:1 odds
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Full Results Table */}
        <motion.div
          className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/20 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <h3 className="text-xl font-bold text-cyan-400 mb-4">Complete Results</h3>
          <div className="space-y-2">
            {results.map((horse, index) => (
              <motion.div
                key={horse.id}
                className={`flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 ${
                  index < 3 ? 'bg-gradient-to-r from-white/10 to-transparent' : ''
                }`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.7 + index * 0.05 }}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getPodiumGradient(horse.placement)} flex items-center justify-center text-white font-bold`}>
                    {horse.placement}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{horse.name}</div>
                    <div className="text-sm text-cyan-300">Lane {horse.lane}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-emerald-400 font-bold">
                    {horse.finishTime?.toFixed(3)}s
                  </div>
                  <div className="text-sm text-gray-400">
                    {horse.odds.toFixed(2)}:1
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          className="flex gap-4 justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <Button
            onClick={handleReplay}
            disabled={showReplay}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-purple-500/25"
          >
            {showReplay ? "🎬 Replaying..." : "🎬 Watch Replay"}
          </Button>
          <button
            onClick={onNewRace}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-bold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            🏇 New Race {autoCloseTimer > 0 ? `(Auto-start in ${autoCloseTimer}s)` : ''}
          </button>
        </motion.div>
      </div>

      {/* Replay Overlay */}
      {showReplay && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="bg-white/10 backdrop-blur-xl rounded-xl p-8 border border-white/20 text-center">
            <div className="text-6xl mb-4 animate-spin">🎬</div>
            <h3 className="text-2xl font-bold text-cyan-400 mb-2">Action Replay</h3>
            <p className="text-cyan-300/80">Reliving the exciting moments...</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}