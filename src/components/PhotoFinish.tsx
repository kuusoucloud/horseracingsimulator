"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Zap, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface PhotoFinishProps {
  results?: Array<{
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
  isVisible?: boolean;
  onClose?: () => void;
}

export default function PhotoFinish({ 
  results = [], 
  isVisible = false, 
  onClose = () => {} 
}: PhotoFinishProps) {
  console.log('📸 PhotoFinish component rendered with results:', results);
  
  const [currentStep, setCurrentStep] = useState<
    "flash" | "capturing" | "analyzing" | "slowmotion" | "revealing"
  >("flash");
  const [revealedPositions, setRevealedPositions] = useState<number[]>([]);
  const [showFlash, setShowFlash] = useState(false);

  // Use actual results from 3D detector instead of mock data
  const actualResults = results.length > 0 ? results : [];
  
  console.log('📸 Using actual 3D detector results:', actualResults);

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
      const sortedHorses = [...actualResults].sort(
        (a, b) => a.placement - b.placement,
      );

      for (let i = sortedHorses.length - 1; i >= 0; i--) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        setRevealedPositions((prev) => [...prev, sortedHorses[i].placement]);
      }

      // Complete the photo finish after all positions revealed
      setTimeout(() => {
        onClose();
      }, 1500);
    };

    sequence();
  }, [isVisible, actualResults, onClose]);

  return (
    <Dialog open={isVisible} onOpenChange={() => {}} modal={false}>
      <DialogContent className="max-w-6xl max-h-[90vh] bg-gray-900/95 border-gray-700 overflow-y-auto" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 text-center mb-2">
            📸 Photo Finish Analysis
          </DialogTitle>
          <DialogDescription className="text-center text-cyan-300/80">
            3D finish line detection system analyzing race results
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 3D Detector Status */}
          <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-4 border border-cyan-500/30">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-cyan-300 font-semibold">3D FINISH LINE DETECTOR ACTIVE</span>
            </div>
            <div className="text-center text-sm text-gray-300">
              High-precision timing system • Millisecond accuracy • Real-time analysis
            </div>
          </div>

          {/* Results Display */}
          {actualResults.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-center text-cyan-300 mb-4">
                🏆 Official Race Results
              </h3>
              
              {actualResults.slice(0, 3).map((result, index) => (
                <div
                  key={result.id || index}
                  className={`
                    relative overflow-hidden rounded-lg border-2 p-4
                    ${index === 0 ? 'border-yellow-400 bg-gradient-to-r from-yellow-900/30 to-yellow-800/30' :
                      index === 1 ? 'border-gray-400 bg-gradient-to-r from-gray-800/30 to-gray-700/30' :
                      'border-orange-400 bg-gradient-to-r from-orange-900/30 to-orange-800/30'}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`
                        text-4xl font-bold
                        ${index === 0 ? 'text-yellow-400' :
                          index === 1 ? 'text-gray-400' :
                          'text-orange-400'}
                      `}>
                        #{result.placement || index + 1}
                      </div>
                      <div>
                        <div className="text-xl font-bold text-white">
                          {result.name}
                        </div>
                        <div className="text-sm text-gray-300">
                          Horse ID: {result.id}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-mono font-bold text-cyan-300">
                        {typeof result.finishTime === 'number' 
                          ? `${result.finishTime.toFixed(3)}s`
                          : `${parseFloat(result.finishTime || '0').toFixed(3)}s`
                        }
                      </div>
                      <div className="text-sm text-gray-400">
                        3D Detected
                      </div>
                    </div>
                  </div>
                  
                  {/* Position indicator */}
                  <div className="absolute top-2 right-2">
                    {index === 0 && <span className="text-2xl">🥇</span>}
                    {index === 1 && <span className="text-2xl">🥈</span>}
                    {index === 2 && <span className="text-2xl">🥉</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📸</div>
              <div className="text-xl text-cyan-300 mb-2">
                Analyzing Photo Finish...
              </div>
              <div className="text-gray-400">
                3D detection system processing race results
              </div>
            </div>
          )}

          {/* Technical Details */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
            <h4 className="text-lg font-semibold text-cyan-300 mb-3">
              🔬 Technical Analysis
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Detection Method:</span>
                <span className="text-white ml-2">3D Spatial Analysis</span>
              </div>
              <div>
                <span className="text-gray-400">Timing Precision:</span>
                <span className="text-white ml-2">±0.001 seconds</span>
              </div>
              <div>
                <span className="text-gray-400">Horses Detected:</span>
                <span className="text-white ml-2">{actualResults.length}/8</span>
              </div>
              <div>
                <span className="text-gray-400">System Status:</span>
                <span className="text-green-400 ml-2">✅ Operational</span>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-center pt-4">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              Continue to Results
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}