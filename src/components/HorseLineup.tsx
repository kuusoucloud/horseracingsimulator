"use client";

import React, { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Horse, Bet } from "@/types/horse";
import { getHorseRank } from "@/lib/utils";
import { getBarrierColor } from "@/lib/utils";
import {
  getHorseDescriptionFromOdds,
  getStoredHorseStats,
  calculateOddsFromELO,
} from "@/data/horses";
import { Trophy } from "lucide-react";

interface HorseLineupProps {
  horses?: Horse[];
  onPlaceBet?: (horse: Horse, betAmount: number) => void;
  selectedBet?: Bet | null;
  raceInProgress?: boolean;
}

export default function HorseLineup({
  horses = [],
  onPlaceBet = () => {},
  selectedBet = null,
  raceInProgress = false,
}: HorseLineupProps) {
  const [selectedHorse, setSelectedHorse] = useState<Horse | null>(null);
  const [betAmount, setBetAmount] = useState<number>(10);
  const [betDialogOpen, setBetDialogOpen] = useState<boolean>(false);
  
  // SIMPLIFIED: Remove complex stability mechanisms that cause flickering
  // Just use the horses directly with basic memoization
  const stableHorses = useMemo(() => {
    return horses || [];
  }, [horses]);

  // Get horse statistics - memoized to prevent unnecessary recalculations
  const horseStats = useMemo(() => getStoredHorseStats(), []);

  // SIMPLIFIED: Basic sorting without complex stability checks
  const sortedHorses = useMemo(() => {
    if (!stableHorses || stableHorses.length === 0) return [];
    
    // Use the odds that are already calculated by the server
    const horsesWithServerOdds = stableHorses.map(horse => ({
      ...horse,
      odds: horse.odds || 5.0
    }));
    
    // Simple sort by odds (lowest odds first = favorites first)
    return [...horsesWithServerOdds].sort((a, b) => a.odds - b.odds);
  }, [stableHorses]);

  const handleSelectHorse = (horse: Horse) => {
    if (raceInProgress) return;
    setSelectedHorse(horse);
    setBetDialogOpen(true);
  };

  const handlePlaceBet = () => {
    if (selectedHorse && onPlaceBet) {
      onPlaceBet(selectedHorse, betAmount);
      setBetDialogOpen(false);
    }
  };

  // SIMPLIFIED: Remove complex memoization that causes flickering
  const getFormDisplay = (horseName: string) => {
    const stats = horseStats[horseName];
    if (!stats || stats.recentForm.length === 0) {
      return <span className="text-white/40 text-xs">No form</span>;
    }

    return (
      <div className="flex items-center gap-0.5">
        {stats.recentForm.map((placement, index) => (
          <span
            key={index}
            className={`text-xs font-bold px-0.5 py-0 rounded text-center w-3 h-3 flex items-center justify-center ${
              placement === 1 ? 'bg-yellow-500/30 text-yellow-300' :
              placement === 2 ? 'bg-gray-400/30 text-gray-300' :
              placement === 3 ? 'bg-orange-500/30 text-orange-300' :
              'bg-white/10 text-white/60'
            }`}
          >
            {placement}
          </span>
        ))}
      </div>
    );
  };

  const getWinsDisplay = (horseName: string) => {
    const stats = horseStats[horseName];
    if (!stats) {
      return <span className="text-white/40 text-xs">0 wins</span>;
    }

    return (
      <div className="flex items-center gap-1">
        <Trophy className="w-3 h-3 text-yellow-400" />
        <span className="text-yellow-300 text-xs font-bold">{stats.wins}</span>
      </div>
    );
  };

  return (
    <div className="w-full h-[600px] relative overflow-hidden">
      {/* Glassmorphism container */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-blue-500/10 rounded-2xl" />
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-50" />
      </div>

      <div className="relative z-10 p-3 h-full flex flex-col">
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm rounded-xl border border-white/10 shadow-2xl p-4 h-full flex flex-col">
          {/* SIMPLIFIED: Direct rendering without complex memoization */}
          <div className="flex-1 flex flex-col justify-between min-h-0 gap-1">
            {sortedHorses.map((horse, index) => {
              const rank = getHorseRank(horse.elo);
              const barrierColor = getBarrierColor(horse.lane || index + 1);
              const serverOdds = horse.odds || 5.0;
              
              return (
                <motion.div
                  key={horse.id} // Simple key based on horse ID
                  className={`p-2 rounded-md transition-all duration-300 backdrop-blur-sm flex-1 max-h-[65px] ${
                    selectedBet?.horseId === horse.id
                      ? "bg-gradient-to-r from-emerald-500/30 to-blue-500/30 border border-emerald-400/50 shadow-lg shadow-emerald-500/20"
                      : "bg-white/5 border border-white/10"
                  }`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="flex items-center gap-1">
                      <div
                        className="w-2.5 h-2.5 rounded-full border border-white/30 shadow-lg"
                        style={{
                          backgroundColor: barrierColor,
                          boxShadow: `0 0 4px ${barrierColor}40`,
                        }}
                      />
                      <span className="text-white/60 font-bold text-xs">
                        #{horse.lane}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <h3 className={`font-bold text-xs truncate ${rank.textColor}`}>
                          {horse.name}
                        </h3>
                        <Badge
                          className={`text-xs px-1 py-0 font-bold ${rank.bgColor} ${rank.borderColor} ${rank.textColor}`}
                        >
                          {rank.name}
                        </Badge>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`font-bold text-xs px-1 py-0 ${
                        serverOdds <= 2.0
                          ? "bg-green-500/20 border-green-400/50 text-green-300"
                          : serverOdds <= 5.0
                            ? "bg-yellow-500/20 border-yellow-400/50 text-yellow-300"
                            : serverOdds <= 10.0
                              ? "bg-orange-500/20 border-orange-400/50 text-orange-300"
                              : "bg-red-500/20 border-red-400/50 text-red-300"
                      }`}
                    >
                      {serverOdds.toFixed(2)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-white/70 italic truncate flex-1">
                      {getHorseDescriptionFromOdds(serverOdds)}
                    </span>
                    <span className="text-white/60 font-mono ml-2">
                      ELO: {Math.round(horse.elo || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 text-xs">Form:</span>
                      {getFormDisplay(horse.name)}
                    </div>
                    <div className="flex items-center gap-1">
                      {getWinsDisplay(horse.name)}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={betDialogOpen} onOpenChange={setBetDialogOpen}>
        <DialogContent className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-bold">Place Your Bet</DialogTitle>
            <DialogDescription className="text-white/80 text-sm">
              Select a horse and place your bet
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ backgroundColor: 'green' }} />
                <span className="text-white/80 text-sm">Current Bet</span>
              </div>
              <span className="text-white font-bold">{selectedHorse?.name || 'None'}</span>
            </div>
            
            <div className="space-y-2">
              <label className="text-white/80 text-sm">Bet Amount</label>
              <Input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                className="w-full bg-white/10 border-white/20 text-white placeholder-white/40"
                min="1"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setBetDialogOpen(false)}
              className="border-white/30 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePlaceBet}
              disabled={!selectedHorse}
              className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white"
            >
              Place Bet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}