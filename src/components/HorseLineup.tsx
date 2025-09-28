"use client";

import React, { useState } from "react";
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
        <motion.div 
          className="mb-3"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            🐎 <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">Horse Lineup</span>
          </h2>
          <p className="text-emerald-300/80 text-xs">Select a horse to place your bet</p>
        </motion.div>
        
        {/* All 8 horses in a fixed height container - sorted by ELO rating (highest first) */}
        <div className="flex-1 flex flex-col justify-between min-h-0">
          {horses
            .sort((a, b) => b.elo - a.elo) // Sort by ELO descending (highest rated first)
            .map((horse, index) => {
              const rank = getHorseRank(horse.elo);
              return (
                <motion.div
                  key={horse.id}
                  className={`p-1.5 rounded-md cursor-pointer transition-all duration-300 backdrop-blur-sm flex-1 max-h-[65px] ${
                    selectedBet?.horseId === horse.id 
                      ? "bg-gradient-to-r from-emerald-500/30 to-blue-500/30 border border-emerald-400/50 shadow-lg shadow-emerald-500/20" 
                      : "bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-400/30"
                  } ${raceInProgress ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={() => handleSelectHorse(horse)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  whileHover={!raceInProgress ? { scale: 1.01 } : {}}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="flex items-center gap-1">
                      <div 
                        className="w-2.5 h-2.5 rounded-full border border-white/30 shadow-lg"
                        style={{ 
                          backgroundColor: horse.color,
                          boxShadow: `0 0 4px ${horse.color}40`
                        }}
                      />
                      <span className="text-white/60 font-bold text-xs">#{horse.lane}</span>
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
                        horse.odds <= 2.0 
                          ? "bg-green-500/20 border-green-400/50 text-green-300"
                          : horse.odds <= 5.0
                          ? "bg-yellow-500/20 border-yellow-400/50 text-yellow-300"
                          : horse.odds <= 10.0
                          ? "bg-orange-500/20 border-orange-400/50 text-orange-300"
                          : "bg-red-500/20 border-red-400/50 text-red-300"
                      }`}
                    >
                      {horse.odds.toFixed(2)}:1
                    </Badge>
                  </div>

                  {/* ELO rating and horse description */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/70 italic truncate flex-1">
                      {horse.description || "Swift and agile"}
                    </span>
                    <span className="text-white/60 font-mono ml-2">
                      ELO: {horse.elo || "N/A"}
                    </span>
                  </div>
                </motion.div>
              );
            })}
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
              {raceInProgress
                ? "🏁 Race in progress..."
                : "💰 Select a horse to place your bet"}
            </p>
          )}
        </motion.div>
      </div>

      <Dialog open={betDialogOpen} onOpenChange={setBetDialogOpen}>
        <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-emerald-400/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
              💰 Place Your Bet
            </DialogTitle>
            <DialogDescription className="text-emerald-300/80">
              {selectedHorse && (
                <div className="mt-4 space-y-3 p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-2">
                    <p className="text-lg">
                      Horse:{" "}
                      <span className={`font-bold ${getHorseRank(selectedHorse.elo).textColor}`}>
                        {selectedHorse.name}
                      </span>
                    </p>
                    <Badge className={`text-xs ${getHorseRank(selectedHorse.elo).bgColor} ${getHorseRank(selectedHorse.elo).borderColor} ${getHorseRank(selectedHorse.elo).textColor}`}>
                      {getHorseRank(selectedHorse.elo).name}
                    </Badge>
                  </div>
                  <p className="text-lg">
                    Odds:{" "}
                    <span className="font-bold text-emerald-300">
                      {selectedHorse.odds.toFixed(2)}:1
                    </span>
                  </p>
                  <p className="text-sm text-white/70">
                    ELO Rating: <span className="font-mono">{selectedHorse.elo}</span>
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bet-amount" className="text-right text-emerald-300 font-semibold">
                Bet Amount
              </Label>
              <Input
                id="bet-amount"
                type="number"
                min="1"
                max="1000"
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                className="col-span-3 bg-white/10 border-emerald-400/30 text-white placeholder-white/50 focus:border-emerald-400"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-right text-sm text-emerald-300/80 font-semibold">
                Potential Win
              </div>
              <div className="col-span-3 font-bold text-3xl text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-400">
                $
                {selectedHorse
                  ? (betAmount * selectedHorse.odds).toFixed(2)
                  : "0.00"}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={() => setBetDialogOpen(false)}
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button 
              onClick={handlePlaceBet} 
              disabled={betAmount < 1}
              className="bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-bold disabled:opacity-50 hover:from-emerald-600 hover:to-blue-600"
            >
              Place Bet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}