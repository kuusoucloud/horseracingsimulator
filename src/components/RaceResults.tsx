"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, X } from "lucide-react";
import {
  getStoredEloRatings,
  STARTING_ELO,
  getStoredHorseStats,
} from "@/data/horses";

interface RaceResult {
  id: string;
  name: string;
  placement: number;
  finishTime: number;
  lane: number;
  odds: number;
  gap?: string;
  horse?: {
    id: string;
    name: string;
    elo: number;
    odds: number;
  };
  eloChange?: {
    before: number;
    after: number;
    change: number;
  };
}

interface RaceResultsProps {
  results: RaceResult[];
  onNewRace: () => void;
  autoCloseTimer?: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function RaceResults({
  results = [],
  onNewRace,
  autoCloseTimer = 0,
  isOpen,
  onClose,
}: RaceResultsProps) {
  const [countdown, setCountdown] = useState(10);

  // Calculate ELO changes when results are available
  const resultsWithEloChanges = useMemo(() => {
    if (!results || results.length === 0) return [];

    const sortedResults = [...results].sort((a, b) => a.placement - b.placement);
    const currentRatings = getStoredEloRatings();
    
    // Calculate ELO changes for each horse
    const resultsWithChanges = sortedResults.map(result => {
      const horseName = result.horse?.name || result.name;
      const currentElo = currentRatings[horseName] || STARTING_ELO;
      
      // Calculate expected ELO change based on placement
      let eloChange = 0;
      const totalHorses = sortedResults.length;
      
      // Use the same ELO calculation logic as in horses.ts
      for (let i = 0; i < sortedResults.length; i++) {
        for (let j = i + 1; j < sortedResults.length; j++) {
          const horse1 = sortedResults[i];
          const horse2 = sortedResults[j];
          
          if (horse1.name === horseName || horse2.name === horseName) {
            const horse1Name = horse1.horse?.name || horse1.name;
            const horse2Name = horse2.horse?.name || horse2.name;
            
            const rating1 = currentRatings[horse1Name] || STARTING_ELO;
            const rating2 = currentRatings[horse2Name] || STARTING_ELO;
            
            const expected1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
            const expected2 = 1 / (1 + Math.pow(10, (rating1 - rating2) / 400));
            
            const k1 = horse1.placement <= 3 ? 192 : 32; // K_FACTOR_PODIUM : K_FACTOR_OTHERS
            const k2 = horse2.placement <= 3 ? 192 : 32;
            
            if (horse1Name === horseName) {
              eloChange += k1 * (1 - expected1);
            } else if (horse2Name === horseName) {
              eloChange += k2 * (0 - expected2);
            }
          }
        }
      }
      
      const newElo = Math.max(100, currentElo + eloChange);
      
      return {
        ...result,
        eloChange: {
          before: currentElo,
          after: newElo,
          change: Math.round(eloChange)
        }
      };
    });
    
    return resultsWithChanges;
  }, [results]);

  // Auto-click "New Race" after 15 seconds (matching server timing)
  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  // Set countdown to 15 seconds to match server timing
  useEffect(() => {
    if (isOpen && results.length > 0) {
      setCountdown(15);
    }
  }, [isOpen, results]);

  // Safety check for results
  if (!results || results.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-gray-900/95 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-cyan-400">
              No Race Results
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-cyan-300/80">
              Complete a race to see results here
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const podiumHorses = resultsWithEloChanges.slice(0, 3);

  const handleNewRace = () => {
    onClose();
    setTimeout(() => {
      onNewRace();
    }, 100);
  };

  const getPodiumEmoji = (placement: number) => {
    switch (placement) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return "🏇";
    }
  };

  const getPodiumGradient = (placement: number) => {
    switch (placement) {
      case 1:
        return "from-yellow-400 via-yellow-500 to-yellow-600";
      case 2:
        return "from-gray-300 via-gray-400 to-gray-500";
      case 3:
        return "from-amber-600 via-amber-700 to-amber-800";
      default:
        return "from-slate-600 via-slate-700 to-slate-800";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}} modal={false}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-gray-900/95 border-gray-700 overflow-y-auto" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 text-center">
            Race Results
          </DialogTitle>
          <DialogDescription className="text-center text-cyan-300/80">
            Official race results with ELO rating changes
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          {/* Podium - Top 3 Only */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {podiumHorses.map((horse, index) => {
              const horseName = horse.horse?.name || horse.name;
              const horseStats = getStoredHorseStats();
              const totalWins = horseStats[horseName]?.wins || 0;

              return (
                <div
                  key={horse.horse?.id || horse.id}
                  className={`bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center ${
                    horse.placement === 1 ? "transform scale-110" : ""
                  }`}
                >
                  <div
                    className={`text-6xl mb-2 ${horse.placement === 1 ? "animate-bounce" : ""}`}
                  >
                    {getPodiumEmoji(horse.placement)}
                  </div>
                  <div
                    className={`w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br ${getPodiumGradient(horse.placement)} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}
                  >
                    {horse.placement}
                  </div>
                  <h3 className="font-bold text-white text-lg mb-1">
                    {horseName}
                  </h3>

                  {/* Career Wins Display */}
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-300 text-sm font-bold">
                      {totalWins} wins
                    </span>
                  </div>

                  {/* ELO Display with Change */}
                  <div className="space-y-2 mb-2">
                    <div className="bg-white/10 rounded-lg p-3">
                      <div className="text-white/70 text-xs mb-2">
                        ELO Rating
                      </div>
                      <div className="text-white font-mono text-lg font-bold mb-2">
                        {Math.round(horse.eloChange?.after || horse.eloChange?.before || STARTING_ELO)}
                      </div>

                      {/* ELO Change Display */}
                      {horse.eloChange && (
                        <div className="text-xs space-y-1 border-t border-white/20 pt-2">
                          <div className="text-white/60">
                            {Math.round(horse.eloChange.before)} → {Math.round(horse.eloChange.after)}
                          </div>
                          <div
                            className={`font-bold text-center px-2 py-1 rounded ${
                              horse.eloChange.change > 0
                                ? "bg-green-500/20 text-green-400"
                                : horse.eloChange.change < 0
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-gray-500/20 text-gray-400"
                            }`}
                          >
                            {horse.eloChange.change > 0 ? "+" : ""}
                            {horse.eloChange.change} ELO
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Badge className="bg-cyan-500/20 border-cyan-400/50 text-cyan-300 text-xs">
                      {horse.finishTime?.toFixed(2)}s
                    </Badge>
                    <div className="text-emerald-300 text-sm font-semibold">
                      {(horse.horse?.odds || horse.odds || 1).toFixed(2)} odds
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* All Results Table */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/20 mb-6">
            <h3 className="text-xl font-bold text-white mb-4 text-center">Complete Results</h3>
            <div className="grid grid-cols-1 gap-2">
              {resultsWithEloChanges.map((horse, index) => {
                const horseName = horse.horse?.name || horse.name;
                return (
                  <div
                    key={horse.horse?.id || horse.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      horse.placement <= 3 
                        ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30' 
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                        horse.placement === 1 ? 'bg-yellow-500' :
                        horse.placement === 2 ? 'bg-gray-400' :
                        horse.placement === 3 ? 'bg-amber-600' :
                        'bg-slate-600'
                      }`}>
                        {horse.placement}
                      </div>
                      <div>
                        <h4 className="font-bold text-white">{horseName}</h4>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-white/60">Lane {horse.lane}</span>
                          <span className="text-emerald-300">{(horse.horse?.odds || horse.odds || 1).toFixed(2)}</span>
                          {horse.eloChange && (
                            <span className={`font-bold ${
                              horse.eloChange.change > 0 ? 'text-green-400' : 
                              horse.eloChange.change < 0 ? 'text-red-400' : 'text-gray-400'
                            }`}>
                              {horse.eloChange.change > 0 ? '+' : ''}{horse.eloChange.change} ELO
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-mono font-bold">
                        {horse.finishTime?.toFixed(2)}s
                      </div>
                      <div className="text-sm text-white/60">
                        {horse.gap || '0.00s'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Server controlled timing display */}
          <div className="flex gap-4 justify-center">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-lg">
              {countdown > 0 ? (
                <>🏇 New race starting in {countdown}s</>
              ) : (
                <>🏇 Server will start new race automatically</>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}