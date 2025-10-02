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
  
  // Stable reference to prevent unnecessary re-renders
  const stableHorsesRef = useRef<Horse[]>([]);
  const lastHorseHash = useRef<string>('');

  // Get horse statistics - memoized to prevent unnecessary recalculations
  const horseStats = useMemo(() => getStoredHorseStats(), []);

  // Create stable horse reference - only update when horses actually change
  const stableHorses = useMemo(() => {
    if (!horses || horses.length === 0) return stableHorsesRef.current;
    
    // Create a hash of horse IDs and names to detect real changes
    const currentHash = horses.map(h => `${h.id}-${h.name}-${h.elo}`).join('|');
    
    // Only update if horses actually changed
    if (currentHash !== lastHorseHash.current) {
      console.log('🏇 HorseLineup: Horses actually changed, updating stable reference');
      stableHorsesRef.current = [...horses];
      lastHorseHash.current = currentHash;
    }
    
    return stableHorsesRef.current;
  }, [horses]);

  // Memoize sorted horses with stable sort and ELO-based odds calculation
  const sortedHorses = useMemo(() => {
    if (!stableHorses || stableHorses.length === 0) return [];
    
    // Use ELO data directly from horses instead of fetching it again
    const horsesWithCalculatedOdds = stableHorses.map(horse => {
      // Calculate odds based on ELO rating (if available)
      const horseElo = horse.elo || 500;
      
      // Simple odds calculation based on ELO - avoid external API calls
      let calculatedOdds;
      if (horseElo >= 800) calculatedOdds = 1.5 + Math.random() * 0.5; // 1.5-2.0
      else if (horseElo >= 700) calculatedOdds = 2.0 + Math.random() * 1.0; // 2.0-3.0
      else if (horseElo >= 600) calculatedOdds = 3.0 + Math.random() * 2.0; // 3.0-5.0
      else if (horseElo >= 500) calculatedOdds = 5.0 + Math.random() * 3.0; // 5.0-8.0
      else if (horseElo >= 400) calculatedOdds = 8.0 + Math.random() * 4.0; // 8.0-12.0
      else calculatedOdds = 12.0 + Math.random() * 8.0; // 12.0-20.0
      
      return {
        ...horse,
        odds: calculatedOdds
      };
    });
    
    // Sort by odds (lowest odds first = favorites first)
    return [...horsesWithCalculatedOdds].sort((a, b) => {
      const oddsDiff = a.odds - b.odds;
      if (Math.abs(oddsDiff) > 0.01) return oddsDiff; // Sort by odds primarily
      
      // If odds are very similar, sort by ELO as tiebreaker (higher ELO first)
      const eloDiff = (b.elo || 500) - (a.elo || 500);
      if (eloDiff !== 0) return eloDiff;
      
      // Final tiebreaker: sort by ID for stability
      return a.id.localeCompare(b.id);
    });
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

  // Helper function to get form display - memoized
  const getFormDisplay = useMemo(() => {
    return (horseName: string) => {
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
  }, [horseStats]);

  // Helper function to get wins display - memoized
  const getWinsDisplay = useMemo(() => {
    return (horseName: string) => {
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
  }, [horseStats]);

  // Memoize horse cards to prevent unnecessary re-renders
  const horseCards = useMemo(() => {
    return sortedHorses.map((horse, index) => {
      const rank = getHorseRank(horse.elo);
      const barrierColor = getBarrierColor(horse.lane || index + 1);
      
      // Use the calculated odds from sorting
      const calculatedOdds = horse.odds || 5.0;
      
      return (
        <motion.div
          key={`stable-${horse.id}-${horse.name}`} // Ultra-stable key
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
                <h3
                  className={`font-bold text-xs truncate ${rank.textColor}`}
                >
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
                calculatedOdds <= 2.0
                  ? "bg-green-500/20 border-green-400/50 text-green-300"
                  : calculatedOdds <= 5.0
                    ? "bg-yellow-500/20 border-yellow-400/50 text-yellow-300"
                    : calculatedOdds <= 10.0
                      ? "bg-orange-500/20 border-orange-400/50 text-orange-300"
                      : "bg-red-500/20 border-red-400/50 text-red-300"
              }`}
            >
              {calculatedOdds.toFixed(2)}:1
            </Badge>
          </div>

          {/* ELO rating and horse description */}
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/70 italic truncate flex-1">
              {getHorseDescriptionFromOdds(calculatedOdds)}
            </span>
            <span className="text-white/60 font-mono ml-2">
              ELO: {Math.round(horse.elo || 0)}
            </span>
          </div>

          {/* Horse Form and Wins */}
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
    });
  }, [sortedHorses, selectedBet, getFormDisplay, getWinsDisplay]);

  return (
    <div className="w-full h-[600px] relative overflow-hidden">
      {/* Glassmorphism container */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl">
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-blue-500/10 rounded-2xl" />

        {/* Glow effects */}
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-50" />
      </div>

      <div className="relative z-10 p-3 h-full flex flex-col">
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm rounded-xl border border-white/10 shadow-2xl p-4 h-full flex flex-col">
          {/* Header showing sorting method */}
          <div className="mb-2 text-center">
            <p className="text-xs text-white/60">
              🏆 Sorted by Odds (Favorites → Longshots)
            </p>
          </div>
          
          {/* All 8 horses in a fixed height container - sorted by odds (lowest first) */}
          <div className="flex-1 flex flex-col justify-between min-h-0 gap-1">
            {horseCards}
          </div>

          <motion.div
            className="mt-2 pt-2 border-t border-white/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            {selectedBet ? (
              <div className="text-center">
                <Badge className="mb-1 bg-emerald-500/30 border-emerald-400/50 text-emerald-300 px-2 py-1 text-xs font-bold">
                  ✅ Your Selection
                </Badge>
                <p className="font-bold text-white text-sm">
                  {selectedBet.horseName}
                </p>
                <p className="text-emerald-300 text-xs">
                  ${selectedBet.amount} @ {selectedBet.odds.toFixed(2)}:1
                </p>
              </div>
            ) : (
              <p className="text-xs text-white/60 text-center">
                {raceInProgress ? "🏁 Race in progress..." : "🏇 Watch the race"}
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}