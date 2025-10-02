"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { Horse, RaceState } from "@/types/horse";
import { getBarrierColor } from "@/lib/utils";
import LiveRankings from "@/components/LiveRankings";

// Global window interface for race communication
declare global {
  interface Window {
    raceControllerVisualFinish?: (horseId: string, finishTime: number) => void;
    finishLineDetector?: {
      recordFinish: (
        horseId: string,
        horseName: string,
        finishTime: number,
      ) => void;
      reset?: () => void;
    };
  }
}

interface RaceTrackProps {
  horses: Horse[];
  raceState: RaceState;
  progress?: Array<{
    id: string;
    name: string;
    position: number;
    speed: number;
    horse?: Horse;
  }>;
  isRacing?: boolean;
  serverWeatherConditions?: WeatherConditions | null;
}

// Weather and time system
interface WeatherConditions {
  timeOfDay: "day" | "night";
  weather: "clear" | "rain";
  skyColor: string;
  ambientIntensity: number;
  directionalIntensity: number;
  trackColor: string;
  grassColor: string;
}

function generateWeatherConditions(): WeatherConditions {
  // Twilight is now 10% chance
  const isTwilight = Math.random() < 0.1;

  // Rain is now 10% chance
  const isRainy = Math.random() < 0.1;

  if (isTwilight) {
    return {
      timeOfDay: "night",
      weather: isRainy ? "rain" : "clear",
      skyColor: isRainy ? "#4a4a6b" : "#6a5acd",
      ambientIntensity: 0.6,
      directionalIntensity: 0.8,
      trackColor: isRainy ? "#5d4e37" : "#8B4513",
      grassColor: isRainy ? "#2d5a2d" : "#228b22",
    };
  } else {
    return {
      timeOfDay: "day",
      weather: isRainy ? "rain" : "clear",
      skyColor: isRainy ? "#6b7280" : "#87ceeb",
      ambientIntensity: 0.4,
      directionalIntensity: isRainy ? 0.7 : 1.0,
      trackColor: isRainy ? "#5d4e37" : "#8B4513",
      grassColor: isRainy ? "#2d5a2d" : "#32cd32",
    };
  }
}

// Collision detection helper function
function checkCollision(
  horse1Pos: [number, number, number],
  horse2Pos: [number, number, number],
  minDistance: number = 2.5,
): boolean {
  const dx = horse1Pos[0] - horse2Pos[0];
  const dz = horse1Pos[2] - horse2Pos[2];
  const distance = Math.sqrt(dx * dx + dz * dz);
  return distance < minDistance;
}

// Resolve collision by adjusting positions
function resolveCollision(
  currentPos: [number, number, number],
  otherPos: [number, number, number],
  minDistance: number = 2.5,
): [number, number, number] {
  const dx = currentPos[0] - otherPos[0];
  const dz = currentPos[2] - otherPos[2];
  const distance = Math.sqrt(dx * dx + dz * dz);

  if (distance < minDistance && distance > 0) {
    // Push horses apart
    const pushFactor = ((minDistance - distance) / distance) * 0.5;
    return [
      currentPos[0] + dx * pushFactor,
      currentPos[1],
      currentPos[2] + dz * pushFactor,
    ];
  }

  return currentPos;
}

// Enhanced collision detection with momentum consideration
function resolveCollisionWithMomentum(
  currentPos: [number, number, number],
  otherPos: [number, number, number],
  currentSpeed: number,
  otherSpeed: number,
  minDistance: number = 2.2,
): [number, number, number] {
  const dx = currentPos[0] - otherPos[0];
  const dz = currentPos[2] - otherPos[2];
  const distance = Math.sqrt(dx * dx + dz * dz);

  if (distance < minDistance && distance > 0) {
    // Much gentler collision resolution
    const basePushFactor = ((minDistance - distance) / distance) * 0.05; // Reduced from 0.3 to 0.05
    const speedDiff = Math.abs(currentSpeed - otherSpeed);
    const momentumFactor = 1 + speedDiff * 0.02; // Reduced from 0.1 to 0.02

    const pushFactor = basePushFactor * momentumFactor;

    // Prefer lateral movement but much more subtle
    const lateralBias = 1.2; // Reduced from 2.0 to 1.2

    return [
      currentPos[0] + dx * pushFactor * 0.2, // Reduced forward push
      currentPos[1],
      currentPos[2] + dz * pushFactor * lateralBias, // Reduced lateral push
    ];
  }

  return currentPos;
}

// Track dimensions constants
const TRACK_LENGTH = 200;
const TRACK_WIDTH = 16;
const START_X = -TRACK_LENGTH / 2;
const FINISH_LINE_X = TRACK_LENGTH / 2;

// Get ELO tier color for aura - using actual rank colors from HorseLineup
function getEloAuraColor(elo: number): string | null {
  if (elo >= 2000) {
    return "#FF1493"; // Deep Pink for Mythical (2000+)
  } else if (elo >= 1900) {
    return "#FFD700"; // Gold for Legendary (1900-1999)
  } else if (elo >= 1800) {
    return "#FF8C00"; // Dark Orange for Champion (1800-1899)
  } else if (elo >= 1700) {
    return "#9370DB"; // Medium Purple for Elite (1700-1799)
  } else if (elo >= 1600) {
    return "#4169E1"; // Royal Blue for Expert (1600-1699)
  }
  return null; // No aura for lower tiers
}

// Get ELO tier name for display - matching HorseLineup
function getEloTierName(elo: number): string {
  if (elo >= 2000) return "MYTHICAL";
  if (elo >= 1900) return "LEGENDARY";
  if (elo >= 1800) return "CHAMPION";
  if (elo >= 1700) return "ELITE";
  if (elo >= 1600) return "EXPERT";
  if (elo >= 1500) return "SKILLED";
  if (elo >= 1400) return "COMPETENT";
  if (elo >= 1300) return "PROMISING";
  if (elo >= 1200) return "DEVELOPING";
  if (elo >= 1000) return "NOVICE";
  return "ROOKIE";
}

// Rain effect component
function RainEffect({ isRaining }: { isRaining: boolean }) {
  const rainRef = useRef<THREE.Points>(null);
  const rainCount = 1000;

  const rainGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    const velocities = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 400; // x
      positions[i * 3 + 1] = Math.random() * 100 + 50; // y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200; // z
      velocities[i] = Math.random() * 2 + 1;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 1));

    return geometry;
  }, []);

  useFrame(() => {
    if (!isRaining || !rainRef.current) return;

    const positions = rainRef.current.geometry.attributes.position
      .array as Float32Array;
    const velocities = rainRef.current.geometry.attributes.velocity
      .array as Float32Array;

    for (let i = 0; i < rainCount; i++) {
      positions[i * 3 + 1] -= velocities[i]; // Move down

      // Reset raindrop when it hits the ground
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 100 + Math.random() * 50;
        positions[i * 3] = (Math.random() - 0.5) * 400;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      }
    }

    rainRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!isRaining) return null;

  return (
    <points ref={rainRef} geometry={rainGeometry}>
      <pointsMaterial color="#87ceeb" size={0.1} transparent opacity={0.6} />
    </points>
  );
}

// Camera that follows the leading horse with ultra-smooth client-side interpolation
function FollowCamera({
  progress,
  isRacing,
  raceState,
}: {
  progress: any[];
  isRacing: boolean;
  raceState: string;
}) {
  // Ultra-smooth camera position with requestAnimationFrame-based interpolation
  const [smoothCameraX, setSmoothCameraX] = useState(START_X);
  const [targetCameraX, setTargetCameraX] = useState(START_X);
  const lastTargetUpdate = useRef<number>(0);

  // Find the actual leading horse by X position
  const getLeadingHorseX = () => {
    if (!isRacing || progress.length === 0) return START_X;

    let maxX = -Infinity;

    progress.forEach((horseProgress) => {
      const horse = horseProgress?.horse || horseProgress;
      const position = horseProgress?.position || 0;

      if (!horse || !horse.name) return;

      // Calculate exact 3D X position (same as horse rendering)
      const progressRatio = position / 1200;
      const extendedFinishX = FINISH_LINE_X + 15;
      const horseX = START_X + progressRatio * (extendedFinishX - START_X);

      if (horseX > maxX) {
        maxX = horseX;
      }
    });

    return maxX;
  };

  // Update target position when server data changes
  useEffect(() => {
    const now = Date.now();
    
    let newTargetX;
    if (
      raceState === "countdown" ||
      raceState === "ready" ||
      raceState === "waiting" ||
      raceState === "pre-race"
    ) {
      newTargetX = START_X;
    } else if (isRacing) {
      const leadingHorseX = getLeadingHorseX();
      // Stop camera movement at finish line, even if horses go beyond
      newTargetX = Math.min(leadingHorseX, FINISH_LINE_X);
    } else if (raceState === "finished") {
      newTargetX = FINISH_LINE_X - 18; // Position slightly before finish line for results view
    } else {
      newTargetX = 0;
    }

    // Only update if target has changed significantly (reduces jitter)
    if (Math.abs(newTargetX - targetCameraX) > 0.3) {
      setTargetCameraX(newTargetX);
      lastTargetUpdate.current = now;
    }
  }, [progress, isRacing, raceState, targetCameraX]);

  // Ultra-smooth camera interpolation using useFrame
  useFrame(({ camera }, delta) => {
    if (!camera) return;

    // Ultra-smooth interpolation with capped delta
    const maxDelta = 0.016; // Cap at 60fps equivalent
    const cappedDelta = Math.min(delta, maxDelta);
    
    // Different interpolation speeds based on racing state
    const interpolationSpeed = isRacing ? 8.0 : 4.0; // Faster during racing
    const lerpFactor = Math.min(cappedDelta * interpolationSpeed, 1.0);
    
    // Calculate smooth camera position
    const newX = smoothCameraX + (targetCameraX - smoothCameraX) * lerpFactor;
    setSmoothCameraX(newX);

    // Set camera position with ultra-smooth interpolated value
    camera.position.set(newX, 8, 16);
    camera.lookAt(newX, 1, 0);
  });

  return null;
}

// Starting gates/barriers
function StartingGates({
  trackWidth,
  numHorses,
}: {
  trackWidth: number;
  numHorses: number;
}) {
  const gates = [];
  const laneWidth = trackWidth / numHorses;

  for (let i = 0; i < numHorses; i++) {
    const laneCenter = -trackWidth / 2 + (i + 0.5) * laneWidth;

    gates.push(
      <group key={`gate-${i}`} position={[-98, 0, laneCenter]}>
        {/* Gate posts */}
        <mesh position={[0, 2, -laneWidth / 4]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 4]} />
          <meshLambertMaterial color="#8B4513" />
        </mesh>
        <mesh position={[0, 2, laneWidth / 4]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 4]} />
          <meshLambertMaterial color="#8B4513" />
        </mesh>

        {/* Gate barrier */}
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[0.2, 2, laneWidth / 2]} />
          <meshLambertMaterial color="#FF4444" />
        </mesh>

        {/* Lane number */}
        <Text
          position={[0, 3, 0]}
          rotation={[0, 0, 0]}
          fontSize={0.8}
          color="#FFFFFF"
          anchorX="center"
          anchorY="middle"
        >
          {i + 1}
        </Text>
      </group>,
    );
  }

  return <>{gates}</>;
}

// Smooth horse component with interpolated movement
interface SmoothHorseProps {
  horse: HorseData;
  targetX: number;
  laneOffset: number;
  position: number;
  isRacing: boolean;
  index: number;
  allHorsePositions?: Array<[number, number, number]>; // Add collision data
}

// Horse data interface for 3D rendering
interface HorseData extends Horse {
  lane?: number;
  color: string;
  elo: number;
  sprintStartPercent?: number;
}

function SmoothHorse({
  horse,
  targetX,
  laneOffset,
  position,
  isRacing,
  index,
  allHorsePositions = [],
}: SmoothHorseProps) {
  const groupRef = useRef<THREE.Group>(null);
  const horseBodyRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Group>(null);
  const whipRef = useRef<THREE.Mesh>(null);

  // Smooth position interpolation - much more responsive
  const [currentX, setCurrentX] = useState(START_X);
  const [currentZ, setCurrentZ] = useState(laneOffset);
  const [hasFinished, setHasFinished] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [raceStartTime, setRaceStartTime] = useState<number | null>(null);

  // Get barrier color based on horse's lane (for jockey shirt/helmet)
  const barrierColor = getBarrierColor(horse.lane || index + 1);

  // Use horse's individual color for the horse body
  const horseColor = horse.color || "#8B4513"; // Fallback to brown

  // Get ELO-based aura color
  const auraColor = getEloAuraColor(horse.elo || 0);
  const eloTier = getEloTierName(horse.elo || 0);

  // Calculate race progress percentage and use horse's individual sprint start
  const raceProgressPercent = (position / 1200) * 100;
  const sprintStartPercent = horse.sprintStartPercent || 60;
  const isInSprintPhase = raceProgressPercent >= sprintStartPercent;

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const clock = state.clock;

    // Reset race timer when racing starts (only once per race)
    if (isRacing && raceStartTime === null) {
      setRaceStartTime(clock.getElapsedTime());
      console.log(
        `🏁 Race timer reset for ${horse.name} at ${clock.getElapsedTime().toFixed(3)}s`,
      );
    }

    // Reset race start time when not racing
    if (!isRacing && raceStartTime !== null) {
      setRaceStartTime(null);
      setHasFinished(false);
    }

    // Calculate race-specific elapsed time
    const raceElapsedTime =
      raceStartTime !== null ? clock.getElapsedTime() - raceStartTime : 0;
    setElapsedTime(raceElapsedTime);

    // Ultra-smooth interpolation - much faster and more responsive
    const interpolationSpeed = isRacing ? 25.0 : 5.0; // Much faster interpolation
    const maxDelta = 0.016; // Cap delta to prevent jumps

    // Calculate desired position with capped delta for smooth movement
    const cappedDelta = Math.min(delta, maxDelta);
    const lerpFactor = Math.min(cappedDelta * interpolationSpeed, 1.0);
    
    let desiredX = currentX + (targetX - currentX) * lerpFactor;
    let desiredZ = currentZ + (laneOffset - currentZ) * lerpFactor;

    // Check if horse has reached the real finish line (not extended)
    if (
      !hasFinished &&
      desiredX >= FINISH_LINE_X &&
      isRacing &&
      raceStartTime !== null
    ) {
      setHasFinished(true);
      const finishTime = raceElapsedTime;
      console.log(
        `🐎 3D Horse ${horse.name} reached finish line at ${finishTime.toFixed(3)}s (X: ${desiredX.toFixed(2)})`,
      );

      // Notify finish line detector that this horse has finished
      if (window.finishLineDetector) {
        console.log(`📡 Notifying finish line detector for ${horse.name}`);
        try {
          window.finishLineDetector.recordFinish(
            horse.id,
            horse.name,
            finishTime,
          );
          console.log(`✅ Successfully recorded finish for ${horse.name}`);
        } catch (error) {
          console.error(`❌ Error recording finish for ${horse.name}:`, error);
        }
      } else {
        console.error(`❌ No finish line detector found for ${horse.name}!`);
        console.log(
          "Available window properties:",
          Object.keys(window).filter(
            (k) => k.includes("finish") || k.includes("race"),
          ),
        );
      }
    }

    // Update positions with ultra-smooth interpolation
    setCurrentX(desiredX);
    setCurrentZ(desiredZ);

    // Update group position with smooth movement
    groupRef.current.position.set(desiredX, 1, desiredZ);

    // Enhanced galloping animation - smoother and more realistic
    if (horseBodyRef.current && isRacing) {
      const time = clock.getElapsedTime();
      const speed = 15; // Even faster galloping for racing
      const amplitude = 0.25; // More pronounced bobbing
      
      // Smooth sine wave for body movement
      horseBodyRef.current.position.y = Math.sin(time * speed + index) * amplitude;
      
      // Slight forward/backward motion for galloping effect
      horseBodyRef.current.position.x = Math.sin(time * speed * 0.5 + index) * 0.1;
    } else if (horseBodyRef.current) {
      // Smooth return to neutral position when not racing
      horseBodyRef.current.position.y = THREE.MathUtils.lerp(
        horseBodyRef.current.position.y,
        0,
        0.15, // Faster return to neutral
      );
      horseBodyRef.current.position.x = THREE.MathUtils.lerp(
        horseBodyRef.current.position.x,
        0,
        0.15,
      );
    }

    // Enhanced whip animation during sprint phase
    if (whipRef.current && isRacing && isInSprintPhase) {
      const time = clock.getElapsedTime();
      const whipSpeed = 8; // Faster whipping motion
      const whipAmplitude = Math.PI / 2.5; // Wider swing

      // More dramatic whipping motion
      const whipRotation = Math.sin(time * whipSpeed + index) * whipAmplitude;
      whipRef.current.rotation.z = -Math.PI / 4 + whipRotation;

      // More pronounced up-down motion
      whipRef.current.position.y = 0.2 + Math.abs(Math.sin(time * whipSpeed + index)) * 0.15;
    } else if (whipRef.current) {
      // Smooth return to neutral position
      whipRef.current.rotation.z = THREE.MathUtils.lerp(
        whipRef.current.rotation.z,
        -Math.PI / 4,
        0.15,
      );
      whipRef.current.position.y = THREE.MathUtils.lerp(
        whipRef.current.position.y,
        0.2,
        0.15,
      );
    }

    // Animate ELO fire ring for expert+ horses - using consistent clock time
    if (auraRef.current && auraColor) {
      const time = clock.getElapsedTime();
      const flickerSpeed =
        horse.elo >= 2000
          ? 1.2
          : horse.elo >= 1900
            ? 1.0
            : horse.elo >= 1800
              ? 0.9
              : 0.8;
      const baseScale = 1.0;
      const flickerAmplitude =
        horse.elo >= 2000
          ? 0.3
          : horse.elo >= 1900
            ? 0.25
            : horse.elo >= 1800
              ? 0.2
              : 0.15;

      // Pulsing scale animation for fire ring
      const scale =
        baseScale + Math.sin(time * flickerSpeed + index) * flickerAmplitude;
      auraRef.current.scale.set(scale, 1, scale); // Only scale X and Z to keep ring flat

      // Tier-specific animations
      if (horse.elo >= 2000) {
        // Mythical: Complex rotation + levitation
        auraRef.current.rotation.y = time * 0.2 + index;
        auraRef.current.position.y = Math.sin(time * 0.3 + index) * 0.1;

        // Animate mystical rings
        if (auraRef.current.children.length > 2) {
          const outerRing =
            auraRef.current.children[auraRef.current.children.length - 2];
          const innerRing =
            auraRef.current.children[auraRef.current.children.length - 1];
          if (outerRing) outerRing.rotation.z = -time * 0.15;
          if (innerRing) innerRing.rotation.z = time * 0.2;
        }
      } else if (horse.elo >= 1900) {
        // Legendary: Fast rotation
        auraRef.current.rotation.y = time * 0.18 + index;
      } else if (horse.elo >= 1800) {
        // Champion: Medium rotation
        auraRef.current.rotation.y = time * 0.15 + index;
      } else if (horse.elo >= 1700) {
        // Elite: Moderate rotation
        auraRef.current.rotation.y = time * 0.12 + index;
      } else if (horse.elo >= 1600) {
        // Expert: Gentle rotation
        auraRef.current.rotation.y = time * 0.1 + index;
      }

      // Animate fire particles around the ring - using consistent clock time
      auraRef.current.children.forEach((child, i) => {
        if (
          i >= 2 &&
          auraRef.current &&
          i < auraRef.current.children.length - (horse.elo >= 2000 ? 2 : 0)
        ) {
          // Skip main rings and mystical rings
          const particleTime =
            time * (horse.elo >= 2000 ? 0.6 : 0.4) + index + i;
          const baseY = 0.2;
          const flickerHeight =
            horse.elo >= 2000 ? 0.6 : horse.elo >= 1900 ? 0.5 : 0.4;

          // Vertical flickering motion for fire particles
          child.position.y = baseY + Math.sin(particleTime) * flickerHeight;

          // Scale flickering for fire effect
          child.scale.setScalar(0.8 + Math.sin(particleTime * 2) * 0.4);
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={[currentX, 1, laneOffset]}>
      {/* Collision Box (invisible) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2.0, 1.5, 1.0]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          visible={false} // Set to true for debugging collision boxes
        />
      </mesh>

      {/* ELO Fire Ring for Expert+ horses */}
      {auraColor && (
        <group ref={auraRef} position={[0, 0, 0]}>
          {/* Flickering flame particles rising up - More realistic fire */}
          {[
            ...Array(
              horse.elo >= 2000
                ? 24
                : horse.elo >= 1900
                  ? 20
                  : horse.elo >= 1800
                    ? 16
                    : horse.elo >= 1700
                      ? 12
                      : 10,
            ),
          ].map((_, i) => {
            const angle =
              (i /
                (horse.elo >= 2000
                  ? 24
                  : horse.elo >= 1900
                    ? 20
                    : horse.elo >= 1800
                      ? 16
                      : horse.elo >= 1700
                        ? 12
                        : 10)) *
              Math.PI *
              2;
            const radius =
              (horse.elo >= 2000
                ? 1.2
                : horse.elo >= 1900
                  ? 1.0
                  : horse.elo >= 1800
                    ? 0.9
                    : horse.elo >= 1700
                      ? 0.8
                      : 0.7) +
              Math.random() * 0.4;
            const flameHeight =
              0.2 + Math.sin(elapsedTime * 0.8 + i) * 0.3 + Math.random() * 0.6;
            const flameIntensity =
              Math.sin(elapsedTime * 1.2 + i * 0.5) * 0.5 + 0.5;
            return (
              <mesh
                key={i}
                position={[
                  Math.cos(angle) * radius + (Math.random() - 0.5) * 0.2,
                  flameHeight,
                  Math.sin(angle) * radius + (Math.random() - 0.5) * 0.2,
                ]}
                rotation={[0, angle, Math.random() * 0.3 - 0.15]}
              >
                <coneGeometry
                  args={[
                    0.06 + Math.random() * 0.08,
                    0.4 + Math.random() * 0.8,
                    4,
                  ]}
                />
                <meshBasicMaterial
                  color={
                    horse.elo >= 2000
                      ? flameIntensity > 0.8
                        ? "#FFB6C1" // Light pink tips
                        : flameIntensity > 0.5
                          ? "#FF69B4" // Hot pink middle
                          : flameIntensity > 0.2
                            ? "#FF1493" // Deep pink
                            : "#C71585" // Medium violet red base
                      : horse.elo >= 1900
                        ? flameIntensity > 0.8
                          ? "#FFFF00" // Bright yellow tips
                          : flameIntensity > 0.5
                            ? "#FFD700" // Gold middle
                            : flameIntensity > 0.2
                              ? "#FFA500" // Orange
                              : "#FF8C00" // Dark orange base
                        : horse.elo >= 1800
                          ? flameIntensity > 0.8
                            ? "#FFA500" // Orange tips
                            : flameIntensity > 0.5
                              ? "#FF8C00" // Dark orange middle
                              : flameIntensity > 0.2
                                ? "#FF6347" // Tomato
                                : "#DC143C" // Crimson base
                          : horse.elo >= 1700
                            ? flameIntensity > 0.8
                              ? "#DA70D6" // Orchid tips
                              : flameIntensity > 0.5
                                ? "#9370DB" // Medium purple middle
                                : flameIntensity > 0.2
                                  ? "#8A2BE2" // Blue violet
                                  : "#4B0082" // Indigo base
                            : flameIntensity > 0.8
                              ? "#87CEEB" // Sky blue tips
                              : flameIntensity > 0.5
                                ? "#4169E1" // Royal blue middle
                                : flameIntensity > 0.2
                                  ? "#0000FF" // Blue
                                  : "#000080" // Navy base
                  }
                  transparent
                  opacity={0.6 + flameIntensity * 0.4}
                />
              </mesh>
            );
          })}

          {/* Inner fire core - smaller and more intense */}
          <mesh position={[0, 0.15, 0]}>
            <sphereGeometry
              args={[
                horse.elo >= 2000
                  ? 0.25
                  : horse.elo >= 1900
                    ? 0.22
                    : horse.elo >= 1800
                      ? 0.18
                      : horse.elo >= 1700
                        ? 0.15
                        : 0.12,
                6,
                6,
              ]}
            />
            <meshBasicMaterial
              color={
                horse.elo >= 2000
                  ? "#FF69B4" // Hot pink for Mythical
                  : horse.elo >= 1900
                    ? "#FFD700" // Gold for Legendary
                    : horse.elo >= 1800
                      ? "#FF8C00" // Dark orange for Champion
                      : horse.elo >= 1700
                        ? "#9370DB" // Medium purple for Elite
                        : "#4169E1" // Royal blue for Expert
              }
              transparent
              opacity={0.9}
            />
          </mesh>

          {/* Floating fire embers and sparks */}
          {[
            ...Array(
              horse.elo >= 2000
                ? 16
                : horse.elo >= 1900
                  ? 14
                  : horse.elo >= 1800
                    ? 12
                    : horse.elo >= 1700
                      ? 10
                      : 8,
            ),
          ].map((_, i) => {
            const emberX = (Math.random() - 0.5) * 3;
            const emberZ = (Math.random() - 0.5) * 3;
            const emberY =
              0.3 + Math.random() * 1.5 + Math.sin(elapsedTime * 0.6 + i) * 0.4;
            const emberSize = 0.02 + Math.random() * 0.04;
            return (
              <mesh key={`ember-${i}`} position={[emberX, emberY, emberZ]}>
                <sphereGeometry args={[emberSize, 4, 4]} />
                <meshBasicMaterial
                  color={
                    horse.elo >= 2000
                      ? Math.random() > 0.6
                        ? "#FF69B4"
                        : Math.random() > 0.3
                          ? "#FFB6C1"
                          : "#FF1493"
                      : horse.elo >= 1900
                        ? Math.random() > 0.6
                          ? "#FFD700"
                          : Math.random() > 0.3
                            ? "#FFA500"
                            : "#FF8C00"
                        : horse.elo >= 1800
                          ? Math.random() > 0.6
                            ? "#FF8C00"
                            : Math.random() > 0.3
                              ? "#FF6347"
                              : "#DC143C"
                          : horse.elo >= 1700
                            ? Math.random() > 0.6
                              ? "#9370DB"
                              : Math.random() > 0.3
                                ? "#8A2BE2"
                                : "#4B0082"
                            : Math.random() > 0.6
                              ? "#4169E1"
                              : Math.random() > 0.3
                                ? "#0000FF"
                                : "#000080"
                  }
                  transparent
                  opacity={0.7 + Math.random() * 0.3}
                />
              </mesh>
            );
          })}

          {/* Additional flame wisps for higher tiers */}
          {horse.elo >= 1800 &&
            [...Array(horse.elo >= 2000 ? 12 : horse.elo >= 1900 ? 10 : 8)].map(
              (_, i) => {
                const wispAngle =
                  (i / (horse.elo >= 2000 ? 12 : horse.elo >= 1900 ? 10 : 8)) *
                    Math.PI *
                    2 +
                  elapsedTime * 0.1;
                const wispRadius = 0.8 + Math.sin(elapsedTime * 0.3 + i) * 0.3;
                const wispHeight =
                  0.8 + Math.sin(elapsedTime * 0.5 + i * 0.7) * 0.5;
                return (
                  <mesh
                    key={`wisp-${i}`}
                    position={[
                      Math.cos(wispAngle) * wispRadius,
                      wispHeight,
                      Math.sin(wispAngle) * wispRadius,
                    ]}
                  >
                    <coneGeometry args={[0.04, 0.25, 3]} />
                    <meshBasicMaterial
                      color={
                        horse.elo >= 2000
                          ? "#FFB6C1"
                          : horse.elo >= 1900
                            ? "#FFD700"
                            : "#FF8C00"
                      }
                      transparent
                      opacity={0.8}
                    />
                  </mesh>
                );
              },
            )}

          {/* Special mythical fire pillars - taller and more dramatic */}
          {horse.elo >= 2000 && (
            <>
              {[...Array(6)].map((_, i) => {
                const angle = (i / 6) * Math.PI * 2;
                const pillarHeight =
                  1.2 + Math.sin(elapsedTime * 0.7 + i) * 0.8;
                const pillarRadius =
                  1.8 + Math.sin(elapsedTime * 0.4 + i * 0.5) * 0.2;
                return (
                  <mesh
                    key={`pillar-${i}`}
                    position={[
                      Math.cos(angle) * pillarRadius,
                      pillarHeight,
                      Math.sin(angle) * pillarRadius,
                    ]}
                    rotation={[0, angle, Math.sin(elapsedTime * 0.5 + i) * 0.1]}
                  >
                    <coneGeometry
                      args={[
                        0.08 + Math.random() * 0.04,
                        1.0 + Math.random() * 0.5,
                        5,
                      ]}
                    />
                    <meshBasicMaterial
                      color={
                        i % 3 === 0
                          ? "#FF69B4"
                          : i % 3 === 1
                            ? "#FFB6C1"
                            : "#FF1493"
                      }
                      transparent
                      opacity={0.8 + Math.random() * 0.2}
                    />
                  </mesh>
                );
              })}
            </>
          )}
        </group>
      )}

      {/* Horse body with galloping animation - using horse's individual color */}
      <mesh ref={horseBodyRef} castShadow>
        <boxGeometry args={[1.5, 1, 0.8]} />
        <meshLambertMaterial color={horseColor} />
      </mesh>

      {/* Horse head - using horse's individual color */}
      <mesh position={[0.8, 0.3, 0]} castShadow>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshLambertMaterial color={horseColor} />
      </mesh>

      {/* Horse mane */}
      <mesh position={[0.5, 0.8, 0]} castShadow>
        <boxGeometry args={[0.8, 0.2, 0.4]} />
        <meshLambertMaterial color="#654321" />
      </mesh>

      {/* Horse tail */}
      <mesh position={[-0.8, 0.2, 0]} castShadow>
        <boxGeometry args={[0.3, 0.6, 0.2]} />
        <meshLambertMaterial color="#654321" />
      </mesh>

      {/* Legs with enhanced galloping animation */}
      {[-0.4, 0.4].map((legX, legIndex) =>
        [-0.3, 0.3].map((legZ, legZIndex) => (
          <mesh
            key={`leg-${legIndex}-${legZIndex}`}
            position={[
              legX,
              -0.8 +
                (isRacing
                  ? Math.sin(
                      Date.now() * 0.02 + legIndex * 2 + legZIndex * 1.5,
                    ) * 0.2
                  : 0),
              legZ +
                (isRacing
                  ? Math.sin(Date.now() * 0.02 + legIndex + legZIndex) * 0.1
                  : 0),
            ]}
            rotation={
              isRacing
                ? [
                    Math.sin(Date.now() * 0.02 + legIndex + legZIndex) * 0.3,
                    0,
                    0,
                  ]
                : [0, 0, 0]
            }
            castShadow
          >
            <cylinderGeometry args={[0.1, 0.1, 0.6]} />
            <meshLambertMaterial color="#654321" />
          </mesh>
        )),
      )}

      {/* Detailed Jockey - using lane color for shirt/helmet */}
      <group position={[0, 0.8, 0]} rotation={[0, Math.PI / 2, 0]}>
        {/* Jockey body */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.4, 0.6, 0.3]} />
          <meshLambertMaterial color={barrierColor} />
        </mesh>

        {/* Jockey head */}
        <mesh position={[0, 0.4, 0]} castShadow>
          <sphereGeometry args={[0.2]} />
          <meshLambertMaterial color={"#FFDBAC"} />
        </mesh>

        {/* Jockey helmet */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <sphereGeometry args={[0.22]} />
          <meshLambertMaterial color={barrierColor} />
        </mesh>

        {/* Jockey arms */}
        <mesh position={[-0.3, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.4]} />
          <meshLambertMaterial color={"#FFDBAC"} />
        </mesh>
        <mesh position={[0.3, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.4]} />
          <meshLambertMaterial color={"#FFDBAC"} />
        </mesh>

        {/* Jockey legs */}
        <mesh position={[-0.15, -0.4, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.3]} />
          <meshLambertMaterial color={"#000080"} />
        </mesh>
        <mesh position={[0.15, -0.4, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.3]} />
          <meshLambertMaterial color={"#000080"} />
        </mesh>

        {/* Racing whip with sprint animation - positioned in right hand */}
        <mesh
          ref={whipRef}
          position={[-0.4, 0.2, 0]}
          rotation={[0, 0, -Math.PI / 4]}
          castShadow
        >
          <cylinderGeometry args={[0.02, 0.02, 0.6]} />
          <meshLambertMaterial
            color={isInSprintPhase && isRacing ? "#FF4444" : "#8B4513"}
          />
        </mesh>

        {/* Whip tip highlight during sprint */}
        {isInSprintPhase && isRacing && (
          <mesh position={[-0.6, 0.4, 0]} castShadow>
            <sphereGeometry args={[0.03]} />
            <meshBasicMaterial color={"#FFFF00"} />
          </mesh>
        )}
      </group>

      {/* Horse name and number label with ELO tier */}
      <Text
        position={[-2.5, 0.5, 0]}
        rotation={[0, 0, 0]}
        fontSize={0.4}
        color={"#FFFFFF"}
        anchorX={"right"}
        anchorY={"middle"}
      >
        #{horse.lane || index + 1} {horse.name}
      </Text>

      {/* ELO tier indicator for elite horses */}
      {auraColor && (
        <Text
          position={[-2.5, 0.1, 0]}
          rotation={[0, 0, 0]}
          fontSize={0.25}
          color={auraColor}
          anchorX={"right"}
          anchorY={"middle"}
        >
          {eloTier} ({horse.elo})
        </Text>
      )}

      {/* Position indicator - using position prop */}
      <Text
        position={[-2.5, auraColor ? -0.3 : -0.1, 0]}
        rotation={[0, 0, 0]}
        fontSize={0.3}
        color={"#FFFF00"}
        anchorX={"right"}
        anchorY={"middle"}
      >
        {Math.round(position)}m
      </Text>
    </group>
  );
}

// Create grass texture function - only on client side with hydration safety
function createGrassTexture() {
  if (typeof window === "undefined") return null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Base grass color
    const baseColor = "#2d5a2d";
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    // Add grass blade patterns with deterministic positioning
    for (let i = 0; i < 8000; i++) {
      // Use deterministic values instead of Math.random() for consistency
      const seed = i * 0.618033988749; // Golden ratio for good distribution
      const x = (seed % 1) * 512;
      const y = ((seed * 7) % 1) * 512;
      const length = 2 + ((seed * 13) % 1) * 6;
      const width = 0.5 + ((seed * 17) % 1) * 1.5;
      const angle = ((seed * 23) % 1) * Math.PI * 2;

      // Vary grass colors deterministically
      const grassColors = ["#228b22", "#32cd32", "#2e8b57", "#3cb371", "#20b2aa"];
      ctx.fillStyle = grassColors[Math.floor(((seed * 31) % 1) * grassColors.length)];

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillRect(-width / 2, 0, width, length);
      ctx.restore();
    }

    // Add some dirt patches deterministically
    for (let i = 0; i < 200; i++) {
      const seed = i * 0.618033988749;
      const x = (seed % 1) * 512;
      const y = ((seed * 7) % 1) * 512;
      const size = 2 + ((seed * 13) % 1) * 8;

      ctx.fillStyle = "#8B4513";
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 4);
    return texture;
  } catch (error) {
    console.warn('Failed to create grass texture:', error);
    return null;
  }
}

// Create wet grass texture for rainy conditions - only on client side with hydration safety
function createWetGrassTexture() {
  if (typeof window === "undefined") return null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Darker base for wet grass
    const baseColor = "#1a4a1a";
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    // Add wet grass blade patterns deterministically
    for (let i = 0; i < 8000; i++) {
      const seed = i * 0.618033988749;
      const x = (seed % 1) * 512;
      const y = ((seed * 7) % 1) * 512;
      const length = 2 + ((seed * 13) % 1) * 6;
      const width = 0.5 + ((seed * 17) % 1) * 1.5;
      const angle = ((seed * 23) % 1) * Math.PI * 2;

      // Darker, more saturated grass colors for wet conditions
      const wetGrassColors = ["#1e5e1e", "#2d5a2d", "#1a4a1a", "#2e4a2e"];
      ctx.fillStyle = wetGrassColors[Math.floor(((seed * 31) % 1) * wetGrassColors.length)];

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillRect(-width / 2, 0, width, length);
      ctx.restore();
    }

    // Add mud patches for wet track deterministically
    for (let i = 0; i < 400; i++) {
      const seed = i * 0.618033988749;
      const x = (seed % 1) * 512;
      const y = ((seed * 7) % 1) * 512;
      const size = 3 + ((seed * 13) % 1) * 10;

      ctx.fillStyle = "#5d4e37";
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Add water puddle reflections deterministically
    for (let i = 0; i < 100; i++) {
      const seed = i * 0.618033988749;
      const x = (seed % 1) * 512;
      const y = ((seed * 7) % 1) * 512;
      const size = 1 + ((seed * 13) % 1) * 4;

      ctx.fillStyle = "#4682b4";
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 4);
    return texture;
  } catch (error) {
    console.warn('Failed to create wet grass texture:', error);
    return null;
  }
}

// Simple null component to resolve the Grandstand reference
const Grandstand = () => null;

export default function RaceTrack({
  horses = [],
  raceState = "pre-race",
  progress = [],
  isRacing = false,
  serverWeatherConditions = null,
}: RaceTrackProps) {
  // Track dimensions - properly scaled for 1200m race
  const numHorses = Math.max(horses.length, progress.length, 8);
  
  // Client-side hydration state
  const [isClient, setIsClient] = useState(false);

  // Use horses data if progress is empty or incomplete
  const displayProgress =
    progress.length > 0
      ? progress
      : horses.map((horse) => ({
          id: horse.id,
          name: horse.name,
          position: 0,
          speed: 0,
          horse: horse,
        }));

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Debug progress data
  useEffect(() => {
    if (progress.length > 0 && isRacing) {
      console.log('🏁 RaceTrack received progress:', {
        raceState,
        isRacing,
        progressCount: progress.length,
        samplePositions: progress.slice(0, 3).map(p => ({
          name: p.name,
          position: p.position,
          speed: p.speed
        }))
      });
    }
  }, [progress, isRacing, raceState]);

  // Use server weather conditions if available, otherwise generate client-side fallback
  const weatherConditions = useMemo(() => {
    console.log('🌤️ Using server weather conditions:', serverWeatherConditions);
    
    if (serverWeatherConditions && typeof serverWeatherConditions === 'object') {
      // Validate that the server weather has all required fields
      if (serverWeatherConditions.timeOfDay && 
          serverWeatherConditions.weather && 
          serverWeatherConditions.skyColor &&
          typeof serverWeatherConditions.ambientIntensity === 'number') {
        console.log('✅ Valid server weather found:', serverWeatherConditions);
        return serverWeatherConditions as WeatherConditions;
      } else {
        console.log('❌ Invalid server weather structure:', serverWeatherConditions);
      }
    } else {
      console.log('❌ No server weather or invalid type:', typeof serverWeatherConditions, serverWeatherConditions);
    }
    
    // Fallback to default conditions (deterministic, no random)
    console.log('⚠️ No valid server weather found, using default conditions');
    return {
      timeOfDay: "day" as const,
      weather: "clear" as const,
      skyColor: "#87ceeb",
      ambientIntensity: 0.4,
      directionalIntensity: 1.0,
      trackColor: "#8B4513",
      grassColor: "#32cd32",
    };
  }, [serverWeatherConditions]);

  // Create textures only on client side after hydration
  const grassTexture = useMemo(() => {
    if (!isClient) return null;
    return createGrassTexture();
  }, [isClient]);
  
  const wetGrassTexture = useMemo(() => {
    if (!isClient) return null;
    return createWetGrassTexture();
  }, [isClient]);

  // Don't render 3D content until client-side hydration is complete
  if (!isClient) {
    return (
      <div
        className="w-full h-full transition-colors duration-1000 relative flex items-center justify-center"
        style={{
          background: `linear-gradient(to bottom, ${weatherConditions.skyColor}, ${weatherConditions.skyColor}dd)`,
        }}
      >
        <div className="text-white text-xl">Loading Race Track...</div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full transition-colors duration-1000 relative"
      style={{
        background: `linear-gradient(to bottom, ${weatherConditions.skyColor}, ${weatherConditions.skyColor}dd)`,
      }}
    >
      {/* Live Rankings - now spans full width at top */}
      <LiveRankings progress={displayProgress} isRacing={isRacing} />

      {/* Weather overlay indicator - top right corner */}
      <div className="absolute top-4 right-4 z-10 bg-black/50 rounded-lg p-3 text-white">
        <div className="flex items-center gap-2 text-lg">
          <span>{weatherConditions.timeOfDay === "night" ? "🌅" : "☀️"}</span>
          <span>{weatherConditions.weather === "rain" ? "🌧️" : "☀️"}</span>
        </div>
        <div className="text-xs text-center mt-1">
          {weatherConditions.weather === "rain" ? "WET TRACK" : "DRY TRACK"}
        </div>
        <div className="text-xs text-center text-gray-300">
          {weatherConditions.timeOfDay === "night" ? "TWILIGHT" : "DAYTIME"}
        </div>
      </div>

      <Canvas shadows camera={{ near: 0.5, far: 2000, fov: 50 }}>
        {/* Custom camera that follows leading horse using actual 3D positions */}
        <FollowCamera
          progress={displayProgress}
          isRacing={isRacing}
          raceState={raceState}
        />

        {/* Dynamic Lighting based on time of day */}
        <ambientLight intensity={weatherConditions.ambientIntensity} />
        <directionalLight
          position={
            weatherConditions.timeOfDay === "night"
              ? [30, 30, 30]
              : [50, 50, 50]
          }
          intensity={weatherConditions.directionalIntensity}
          color={
            weatherConditions.timeOfDay === "night" ? "#ffa500" : "#ffffff"
          }
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={200}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
        />

        {/* Additional twilight lighting */}
        {weatherConditions.timeOfDay === "night" && (
          <>
            {/* Warm twilight lights */}
            <pointLight
              position={[-50, 20, -20]}
              intensity={0.4}
              color="#ff6347"
            />
            <pointLight
              position={[0, 20, -20]}
              intensity={0.4}
              color="#ffa500"
            />
            <pointLight
              position={[50, 20, -20]}
              intensity={0.4}
              color="#ff6347"
            />
            <pointLight
              position={[-50, 20, 20]}
              intensity={0.4}
              color="#ffa500"
            />
            <pointLight
              position={[0, 20, 20]}
              intensity={0.4}
              color="#ff6347"
            />
            <pointLight
              position={[50, 20, 20]}
              intensity={0.4}
              color="#ffa500"
            />
          </>
        )}

        {/* Rain Effect */}
        <RainEffect isRaining={weatherConditions.weather === "rain"} />

        {/* Track surface with realistic grass texture */}
        <group>
          {/* Main track base with grass texture */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[TRACK_LENGTH, TRACK_WIDTH]} />
            <meshLambertMaterial
              map={
                weatherConditions.weather === "rain"
                  ? wetGrassTexture
                  : grassTexture
              }
              color={weatherConditions.grassColor}
            />
          </mesh>

          {/* Individual grass lanes with texture */}
          {Array.from({ length: numHorses }, (_, i) => {
            const laneWidth = TRACK_WIDTH / numHorses;
            const laneCenter = -TRACK_WIDTH / 2 + (i + 0.5) * laneWidth;

            return (
              <mesh
                key={`grass-lane-${i}`}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.01, laneCenter]}
                receiveShadow
              >
                <planeGeometry args={[TRACK_LENGTH, laneWidth * 0.8]} />
                <meshLambertMaterial
                  map={
                    weatherConditions.weather === "rain"
                      ? wetGrassTexture
                      : grassTexture
                  }
                  color={weatherConditions.grassColor}
                  transparent
                  opacity={0.9}
                />
              </mesh>
            );
          })}
        </group>

        {/* Track borders */}
        <mesh position={[0, 0.1, TRACK_WIDTH / 2 + 0.5]} castShadow>
          <boxGeometry args={[TRACK_LENGTH, 0.2, 1]} />
          <meshLambertMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[0, 0.1, -TRACK_WIDTH / 2 - 0.5]} castShadow>
          <boxGeometry args={[TRACK_LENGTH, 0.2, 1]} />
          <meshLambertMaterial color="#FFFFFF" />
        </mesh>

        {/* Starting line */}
        <group position={[START_X, 0, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <planeGeometry args={[0.5, TRACK_WIDTH]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          <Text
            position={[0, 2, 0]}
            rotation={[0, 0, 0]}
            fontSize={1.5}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
          >
            START
          </Text>
        </group>

        {/* Finish line with checkered pattern */}
        <group position={[FINISH_LINE_X, 0, 0]}>
          {/* Checkered finish line */}
          {Array.from({ length: 20 }, (_, i) => (
            <mesh
              key={`checker-${i}`}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[
                0,
                0.03,
                -TRACK_WIDTH / 2 + (i * TRACK_WIDTH) / 20 + TRACK_WIDTH / 40,
              ]}
            >
              <planeGeometry args={[0.5, TRACK_WIDTH / 20]} />
              <meshBasicMaterial color={i % 2 === 0 ? "#FFFFFF" : "#000000"} />
            </mesh>
          ))}

          {/* Finish line posts */}
          <mesh position={[0, 3, -TRACK_WIDTH / 2 - 1]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 6]} />
            <meshLambertMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[0, 3, TRACK_WIDTH / 2 + 1]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 6]} />
            <meshLambertMaterial color="#FFFFFF" />
          </mesh>

          {/* Checkered flags */}
          <mesh
            position={[-0.5, 4, -TRACK_WIDTH / 2 - 1]}
            rotation={[0, 0, 0.3]}
          >
            <planeGeometry args={[1.5, 1]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          <mesh
            position={[-0.5, 4, TRACK_WIDTH / 2 + 1]}
            rotation={[0, 0, -0.3]}
          >
            <planeGeometry args={[1.5, 1]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>

          <Text
            position={[0, 5, 0]}
            rotation={[0, 0, 0]}
            fontSize={1.5}
            color="#FFD700"
            anchorX="center"
            anchorY="middle"
          >
            FINISH
          </Text>
        </group>

        {/* Starting gates */}
        <StartingGates trackWidth={TRACK_WIDTH} numHorses={numHorses} />

        {/* Jockey Club House - Modern structure with glass windows */}
        <group position={[0, 0, -TRACK_WIDTH / 2 - 15]}>
          {/* Main club house structure - extended along x-axis */}
          <mesh position={[0, 8, 0]} castShadow receiveShadow>
            <boxGeometry args={[120, 16, 12]} />
            <meshLambertMaterial color="#f5f5dc" />
          </mesh>

          {/* Glass windows - front facade - extended */}
          <mesh position={[0, 8, 6.1]} castShadow>
            <boxGeometry args={[115, 12, 0.2]} />
            <meshLambertMaterial color="#87ceeb" transparent opacity={0.3} />
          </mesh>

          {/* Glass window frames - more frames for extended building */}
          {Array.from({ length: 16 }, (_, i) => (
            <mesh
              key={`window-frame-${i}`}
              position={[-56.25 + i * 7.5, 8, 6.2]}
              castShadow
            >
              <boxGeometry args={[0.3, 12, 0.1]} />
              <meshLambertMaterial color="#2c3e50" />
            </mesh>
          ))}

          {/* Horizontal window dividers - extended */}
          <mesh position={[0, 8, 6.2]} castShadow>
            <boxGeometry args={[115, 0.3, 0.1]} />
            <meshLambertMaterial color="#2c3e50" />
          </mesh>
          <mesh position={[0, 12, 6.2]} castShadow>
            <boxGeometry args={[115, 0.3, 0.1]} />
            <meshLambertMaterial color="#2c3e50" />
          </mesh>
          <mesh position={[0, 4, 6.2]} castShadow>
            <boxGeometry args={[115, 0.3, 0.1]} />
            <meshLambertMaterial color="#2c3e50" />
          </mesh>

          {/* Roof - extended */}
          <mesh position={[0, 16.5, 0]} castShadow>
            <boxGeometry args={[125, 1, 14]} />
            <meshLambertMaterial color="#8b4513" />
          </mesh>

          {/* Side wings - moved further out */}
          <mesh position={[-65, 6, 0]} castShadow receiveShadow>
            <boxGeometry args={[10, 12, 10]} />
            <meshLambertMaterial color="#f5f5dc" />
          </mesh>
          <mesh position={[65, 6, 0]} castShadow receiveShadow>
            <boxGeometry args={[10, 12, 10]} />
            <meshLambertMaterial color="#f5f5dc" />
          </mesh>

          {/* Side wing glass - moved further out */}
          <mesh position={[-65, 6, 5.1]} castShadow>
            <boxGeometry args={[8, 8, 0.2]} />
            <meshLambertMaterial color="#87ceeb" transparent opacity={0.3} />
          </mesh>
          <mesh position={[65, 6, 5.1]} castShadow>
            <boxGeometry args={[8, 8, 0.2]} />
            <meshLambertMaterial color="#87ceeb" transparent opacity={0.3} />
          </mesh>

          {/* Entrance pillars */}
          <mesh position={[-15, 2, 6]} castShadow>
            <cylinderGeometry args={[0.8, 0.8, 4]} />
            <meshLambertMaterial color="#2c3e50" />
          </mesh>
          <mesh position={[15, 2, 6]} castShadow>
            <cylinderGeometry args={[0.8, 0.8, 4]} />
            <meshLambertMaterial color="#2c3e50" />
          </mesh>

          {/* Additional entrance pillars for extended building */}
          <mesh position={[-45, 2, 6]} castShadow>
            <cylinderGeometry args={[0.8, 0.8, 4]} />
            <meshLambertMaterial color="#2c3e50" />
          </mesh>
          <mesh position={[45, 2, 6]} castShadow>
            <cylinderGeometry args={[0.8, 0.8, 4]} />
            <meshLambertMaterial color="#2c3e50" />
          </mesh>

          {/* Balcony - extended */}
          <mesh position={[0, 16, 8]} castShadow>
            <boxGeometry args={[110, 0.5, 4]} />
            <meshLambertMaterial color="#2c3e50" />
          </mesh>

          {/* Balcony railing - extended */}
          <mesh position={[0, 17.5, 10]} castShadow>
            <boxGeometry args={[110, 1, 0.2]} />
            <meshLambertMaterial color="#2c3e50" />
          </mesh>

          {/* Club house sign */}
          <mesh position={[0, 12, 6.5]} castShadow>
            <boxGeometry args={[20, 2, 0.1]} />
            <meshLambertMaterial color="#2c3e50" />
          </mesh>

          {/* Landscaping around club house - more trees for extended building */}
          {Array.from({ length: 20 }, (_, i) => {
            // Static positioning - calculate once and store
            const staticX = -70 + i * 7;
            const staticZ = -20;
            return (
              <mesh
                key={`tree-${i}`}
                position={[staticX, 3, staticZ]}
                castShadow
              >
                <cylinderGeometry args={[0.5, 0.8, 6]} />
                <meshLambertMaterial color="#8b4513" />
              </mesh>
            );
          })}

          {/* Tree foliage - more trees for extended building */}
          {Array.from({ length: 20 }, (_, i) => {
            // Static positioning - calculate once and store
            const staticX = -70 + i * 7;
            const staticZ = -20;
            return (
              <mesh
                key={`foliage-${i}`}
                position={[staticX, 6, staticZ]}
                castShadow
              >
                <sphereGeometry args={[2.5]} />
                <meshLambertMaterial color="#228b22" />
              </mesh>
            );
          })}
        </group>

        {/* Grandstand */}
        <Grandstand />

        {/* 3D Horses */}
        {(() => {
          // First pass: calculate all horse positions for collision detection
          const allHorsePositions: Array<[number, number, number]> =
            displayProgress.map((horseProgress, index) => {
              const horse = horseProgress?.horse || horseProgress;
              const position = horseProgress?.position || 0;

              if (!horse || !horse.name) return [0, 1, 0];

              // Map race progress (0-1200m) to 3D track with extended finish line
              const raceDistance = 1200;
              const progressRatio = position / raceDistance;

              // Use extended finish line so horses don't slow down at real finish
              const actualFinishX = FINISH_LINE_X; // Real finish at 100
              const extendedFinishX = FINISH_LINE_X + 15; // Extended finish at 115

              // Target the extended finish line to maintain speed through real finish
              const targetX =
                START_X + progressRatio * (extendedFinishX - START_X);

              // Calculate lane position using horse's actual lane assignment
              const laneWidth = TRACK_WIDTH / numHorses;
              const actualLane = ('lane' in horse ? horse.lane : null) || index + 1;
              let baseLaneOffset =
                -TRACK_WIDTH / 2 + (actualLane - 0.5) * laneWidth;

              // Add dynamic lateral spread during pack racing phase - but reduce it near finish
              const raceProgressPercent = (position / raceDistance) * 100;
              const isInPackPhase =
                raceProgressPercent > 10 && raceProgressPercent < 70;
              const isNearFinish = raceProgressPercent > 85; // Reduce jostling near finish

              let laneOffset = baseLaneOffset;
              if (isInPackPhase && isRacing && !isNearFinish) {
                const packSpread = 1.5;
                const spreadFactor =
                  Math.sin(Date.now() * 0.001 + index * 0.7) * packSpread;
                const frontRunnerBonus =
                  Math.max(0, (position - 200) / 800) * 0.8;

                laneOffset += spreadFactor * (0.5 + frontRunnerBonus);

                const maxOffset = TRACK_WIDTH / 2 - 1;
                laneOffset = Math.max(
                  -maxOffset,
                  Math.min(maxOffset, laneOffset),
                );
              } else if (isNearFinish && isRacing) {
                // Gradually return to lane positions near finish for accurate finish line crossing
                const finishApproachFactor = Math.max(
                  0,
                  (raceProgressPercent - 85) / 15,
                ); // 0 to 1 over final 15%
                laneOffset =
                  baseLaneOffset +
                  (laneOffset - baseLaneOffset) * (1 - finishApproachFactor);
              }

              return [targetX, 1, laneOffset] as [number, number, number];
            });

          // Second pass: render horses with collision data
          return displayProgress.map((horseProgress, index) => {
            const horse = horseProgress?.horse || horseProgress;
            const position = horseProgress?.position || 0;

            if (!horse || !horse.name) return null;

            const [targetX, , laneOffset] = allHorsePositions[index];
            const actualLane = ('lane' in horse ? horse.lane : null) || index + 1;

            // Ensure we have a proper HorseData object
            const horseData: HorseData = {
              ...horse,
              lane: actualLane,
              color: ('color' in horse ? horse.color : null) || "#8B4513",
              elo: ('elo' in horse ? horse.elo : null) || 1000,
              stamina: ('stamina' in horse ? horse.stamina : null) || 50,
              acceleration: ('acceleration' in horse ? horse.acceleration : null) || 50,
              odds: ('odds' in horse ? horse.odds : null) || 5.0,
              sprintStartPercent: ('sprintStartPercent' in horse ? horse.sprintStartPercent : null) || 60,
            };

            return (
              <SmoothHorse
                key={horse.id || index}
                horse={horseData}
                targetX={targetX}
                laneOffset={laneOffset}
                position={position}
                isRacing={isRacing}
                index={index}
                allHorsePositions={allHorsePositions}
              />
            );
          });
        })()}

        {/* Ground plane with grass texture */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.5, 0]}
          receiveShadow
        >
          <planeGeometry args={[300, 100]} />
          <meshLambertMaterial
            map={
              weatherConditions.weather === "rain"
                ? wetGrassTexture
                : grassTexture
            }
            color={weatherConditions.grassColor}
          />
        </mesh>

        {/* Enhanced Atmospheric Effects */}
        {/* Fog for depth and atmosphere */}
        <fog
          attach="fog"
          args={[
            weatherConditions.timeOfDay === "night"
              ? "#2c1810"
              : weatherConditions.weather === "rain"
                ? "#6b7280"
                : "#87ceeb",
            50,
            weatherConditions.weather === "rain" ? 120 : 150,
          ]}
        />

        {/* Additional atmospheric lighting for cinematic effect */}
        {weatherConditions.timeOfDay === "night" && (
          <>
            {/* Rim lighting for dramatic silhouettes */}
            <directionalLight
              position={[-30, 10, 30]}
              intensity={0.3}
              color="#ff6347"
            />
            <directionalLight
              position={[30, 10, -30]}
              intensity={0.3}
              color="#ffa500"
            />
          </>
        )}

        {/* Enhanced lighting for clear day */}
        {weatherConditions.weather === "clear" &&
          weatherConditions.timeOfDay === "day" && (
            <>
              {/* Fill light for softer shadows */}
              <directionalLight
                position={[-20, 30, 20]}
                intensity={0.2}
                color="#ffffff"
              />
              {/* Sky light simulation */}
              <hemisphereLight
                color="#87ceeb"
                groundColor="#228b22"
                intensity={0.3}
              />
            </>
          )}

        {/* Volumetric light rays for dramatic effect */}
        {weatherConditions.timeOfDay === "night" && (
          <group>
            {/* Light shafts */}
            {[...Array(6)].map((_, i) => (
              <mesh
                key={`light-shaft-${i}`}
                position={[-60 + i * 24, 15, -30 + Math.sin(i) * 10]}
                rotation={[Math.PI / 6, i * 0.3, 0]}
              >
                <coneGeometry args={[2, 20, 8, 1, true]} />
                <meshBasicMaterial
                  color="#ffa500"
                  transparent
                  opacity={0.1}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ))}
          </group>
        )}
      </Canvas>
    </div>
  );
}