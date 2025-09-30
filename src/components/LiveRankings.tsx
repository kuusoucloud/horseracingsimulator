import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LiveRankingsProps {
  progress: Array<{
    id: string;
    name: string;
    position: number;
    speed: number;
    horse?: {
      id: string;
      name: string;
      lane?: number;
      color?: string;
    };
  }>;
  isRacing: boolean;
}

export default function LiveRankings({
  progress,
  isRacing,
}: LiveRankingsProps) {
  if (!isRacing || progress.length === 0) {
    return null;
  }

  // Sort horses by position (furthest distance first)
  const sortedHorses = [...progress]
    .filter((horse) => horse.horse?.name) // Only show horses with valid data
    .sort((a, b) => b.position - a.position);

  return (
    <div className="absolute top-8 left-4 right-40 z-10 bg-black/60 backdrop-blur-sm border border-white/20 rounded-lg">
      <div className="flex items-center justify-between px-3 py-1.5">
        <AnimatePresence>
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            {sortedHorses.map((horseProgress, index) => {
              const horse = horseProgress.horse;
              const position = Math.round(horseProgress.position);
              const rankPosition = index + 1;

              return (
                <motion.div
                  key={horse?.id || index}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3, delay: index * 0.02 }}
                  className="flex items-center gap-1 text-xs bg-white/10 rounded-full px-2 py-0.5 whitespace-nowrap"
                >
                  <span
                    className={`font-bold text-xs ${
                      rankPosition === 1
                        ? "text-yellow-400"
                        : rankPosition === 2
                          ? "text-gray-300"
                          : rankPosition === 3
                            ? "text-orange-400"
                            : "text-white"
                    }`}
                  >
                    #{rankPosition}
                  </span>
                  <span className="text-white text-xs max-w-[50px] truncate">
                    {horse?.name || "Unknown"}
                  </span>
                  <span className="text-green-400 font-mono text-xs">
                    {position}m
                  </span>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>

        <div className="text-xs text-gray-300 font-mono ml-2">1200m</div>
      </div>
    </div>
  );
}
