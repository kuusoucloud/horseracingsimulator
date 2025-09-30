"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Zap, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PhotoFinishProps {
  finishingHorses: Array<{
    id: string;
    name: string;
    placement: number;
    finishTime: number;
    odds: number;
    horse?: {
      id: string;
      name: string;
      elo: number;
      odds: number;
    };
  }>;
  onPhotoFinishComplete: (finalResults: any[]) => void;
  isVisible: boolean;
}

export default function PhotoFinish({
  finishingHorses,
  onPhotoFinishComplete,
  isVisible,
}: PhotoFinishProps) {
  const [currentStep, setCurrentStep] = useState<
    "flash" | "capturing" | "analyzing" | "slowmotion" | "revealing"
  >("flash");
  const [revealedPositions, setRevealedPositions] = useState<number[]>([]);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    // Photo finish sequence
    const sequence = async () => {
      // Step 1: Camera flash (0.5 seconds)
      setCurrentStep("flash");
      setShowFlash(true);
      await new Promise((resolve) => setTimeout(resolve, 200));
      setShowFlash(false);
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Step 2: Capturing (1.5 seconds)
      setCurrentStep("capturing");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Step 3: Analyzing (2 seconds)
      setCurrentStep("analyzing");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 4: Slow motion replay (3 seconds)
      setCurrentStep("slowmotion");
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Step 5: Revealing results one by one
      setCurrentStep("revealing");

      // Reveal positions one by one (3rd, 2nd, 1st)
      const sortedHorses = [...finishingHorses].sort(
        (a, b) => a.placement - b.placement,
      );

      for (let i = sortedHorses.length - 1; i >= 0; i--) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        setRevealedPositions((prev) => [...prev, sortedHorses[i].placement]);
      }

      // Complete the photo finish after all positions revealed
      setTimeout(() => {
        onPhotoFinishComplete(finishingHorses);
      }, 1500);
    };

    sequence();
  }, [isVisible, finishingHorses, onPhotoFinishComplete]);

  if (!isVisible) return null;

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
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Camera Flash Effect */}
        {showFlash && (
          <motion.div
            className="fixed inset-0 bg-white z-60"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.2 }}
          />
        )}

        <div className="w-full max-w-4xl mx-4">
          {/* Photo Finish Header */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center justify-center gap-4 mb-4">
              <Camera className="w-12 h-12 text-cyan-400" />
              <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                📸 PHOTO FINISH
              </h1>
              <Camera className="w-12 h-12 text-cyan-400" />
            </div>
            <p className="text-xl text-cyan-300/80">
              Too close to call - reviewing photo evidence
            </p>
          </motion.div>

          {/* Flash Phase */}
          {currentStep === "flash" && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-6xl mb-4">📸</div>
              <h2 className="text-3xl font-bold text-white">*FLASH*</h2>
            </motion.div>
          )}

          {/* Capturing Phase */}
          {currentStep === "capturing" && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <div className="relative mb-8">
                <motion.div
                  className="w-32 h-32 mx-auto bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center"
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Camera className="w-16 h-16 text-white" />
                </motion.div>
              </div>

              <h2 className="text-3xl font-bold text-white mb-4">
                📷 Capturing High-Speed Footage
              </h2>
              <p className="text-cyan-300 text-lg">
                Recording the exact finish line moment...
              </p>
            </motion.div>
          )}

          {/* Analyzing Phase */}
          {currentStep === "analyzing" && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <div className="mb-8">
                <motion.div
                  className="w-32 h-32 mx-auto bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center"
                  animate={{
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <Zap className="w-16 h-16 text-white" />
                </motion.div>
              </div>

              <h2 className="text-3xl font-bold text-white mb-4">
                🔍 Analyzing Photo Evidence
              </h2>
              <p className="text-purple-300 text-lg mb-6">
                Frame-by-frame analysis in progress...
              </p>

              {/* Progress indicators */}
              <div className="flex justify-center gap-2">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 bg-purple-400 rounded-full"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Slow Motion Replay Phase */}
          {currentStep === "slowmotion" && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <div className="mb-8">
                <motion.div
                  className="w-40 h-24 mx-auto bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center border-4 border-white/20"
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <div className="text-white text-center">
                    <div className="text-2xl font-bold">🎬</div>
                    <div className="text-xs">SLOW-MO</div>
                  </div>
                </motion.div>
              </div>

              <h2 className="text-3xl font-bold text-white mb-4">
                🎬 Slow Motion Replay
              </h2>
              <p className="text-green-300 text-lg mb-6">
                Reviewing the finish line crossing in slow motion...
              </p>

              {/* Animated horses crossing finish line */}
              <div className="relative w-full max-w-2xl mx-auto h-20 bg-gradient-to-r from-green-800/30 to-green-600/30 rounded-lg border border-green-400/30 overflow-hidden">
                <div className="absolute right-4 top-0 bottom-0 w-1 bg-white/80"></div>
                <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-yellow-400 animate-pulse"></div>

                {finishingHorses
                  .sort((a, b) => a.placement - b.placement)
                  .slice(0, 3)
                  .map((horse, index) => {
                    // Calculate staggered finish positions based on actual finish times
                    const baseFinishPosition = 320; // Base finish line position
                    const timeGap = horse.finishTime - finishingHorses[0].finishTime;
                    const positionOffset = timeGap * 50; // Convert time gap to visual distance
                    const finalPosition = baseFinishPosition - positionOffset;
                    
                    return (
                      <motion.div
                        key={horse.id}
                        className={`absolute left-0 text-2xl flex items-center gap-1`}
                        style={{ top: `${8 + index * 18}px` }}
                        animate={{
                          x: [0, 280, finalPosition, finalPosition + 5],
                        }}
                        transition={{
                          duration: 4,
                          ease: "easeOut",
                          delay: index * 0.05, // Slight stagger based on placement
                        }}
                      >
                        <span>🏇</span>
                        <span className="text-xs font-bold text-white bg-black/50 px-1 rounded">
                          {horse.name.split(' ')[0]}
                        </span>
                      </motion.div>
                    );
                  })}
              </div>

              <p className="text-green-300/80 text-sm mt-4">
                Analyzing finish times: {finishingHorses.slice(0, 3).map(h => 
                  `${h.name.split(' ')[0]} (${h.finishTime.toFixed(3)}s)`
                ).join(', ')}
              </p>
            </motion.div>
          )}

          {/* Revealing Phase */}
          {currentStep === "revealing" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <h2 className="text-3xl font-bold text-white mb-8">
                🏆 Official Photo Finish Results
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                {finishingHorses
                  .sort((a, b) => a.placement - b.placement)
                  .map((horse, index) => (
                    <motion.div
                      key={horse.id}
                      className={`relative ${
                        revealedPositions.includes(horse.placement)
                          ? "opacity-100"
                          : "opacity-30"
                      }`}
                      initial={{ opacity: 0, y: 50, scale: 0.8 }}
                      animate={{
                        opacity: revealedPositions.includes(horse.placement)
                          ? 1
                          : 0.3,
                        y: 0,
                        scale: revealedPositions.includes(horse.placement)
                          ? 1
                          : 0.8,
                      }}
                      transition={{
                        duration: 0.8,
                        type: "spring",
                        bounce: 0.4,
                      }}
                    >
                      {/* Reveal animation */}
                      {revealedPositions.includes(horse.placement) && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-transparent rounded-xl"
                          initial={{ scale: 0 }}
                          animate={{ scale: [0, 1.2, 1] }}
                          transition={{ duration: 0.6 }}
                        />
                      )}

                      <div
                        className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center ${
                          horse.placement === 1
                            ? "transform scale-110 border-yellow-400/50"
                            : ""
                        }`}
                      >
                        <div
                          className={`text-6xl mb-4 ${
                            revealedPositions.includes(horse.placement) &&
                            horse.placement === 1
                              ? "animate-bounce"
                              : ""
                          }`}
                        >
                          {getPodiumEmoji(horse.placement)}
                        </div>

                        <div
                          className={`w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br ${getPodiumGradient(horse.placement)} flex items-center justify-center text-3xl font-bold text-white shadow-lg`}
                        >
                          {revealedPositions.includes(horse.placement)
                            ? horse.placement
                            : "?"}
                        </div>

                        <h3 className="font-bold text-white text-xl mb-2">
                          {horse.name}
                        </h3>

                        {revealedPositions.includes(horse.placement) && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="space-y-2"
                          >
                            <Badge className="bg-cyan-500/20 border-cyan-400/50 text-cyan-300">
                              {horse.finishTime?.toFixed(6)}s
                            </Badge>
                            <div className="text-emerald-300 text-sm font-semibold">
                              {horse.odds.toFixed(2)}:1 odds
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}
              </div>

              {/* Show completion message when all positions revealed */}
              {revealedPositions.length === finishingHorses.length && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  className="mt-8"
                >
                  <h3 className="text-2xl font-bold text-green-400 mb-2">
                    ✅ Photo Finish Complete!
                  </h3>
                  <p className="text-green-300/80">
                    Official results confirmed by high-speed camera analysis
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}