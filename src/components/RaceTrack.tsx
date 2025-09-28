import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { Horse } from '@/types/horse';

interface RaceTrackProps {
  progress: Array<{
    id: string;
    name: string;
    position: number;
    speed: number;
    horse?: {
      id: string;
      name: string;
      color?: string;
    };
  }>;
  isRacing: boolean;
  raceState?: string;
}

// Weather and time system
interface WeatherConditions {
  timeOfDay: 'day' | 'night';
  weather: 'clear' | 'rain';
  skyColor: string;
  ambientIntensity: number;
  directionalIntensity: number;
  trackColor: string;
  grassColor: string;
}

function generateWeatherConditions(): WeatherConditions {
  // Twilight is rare (15% chance)
  const isTwilight = Math.random() < 0.15;
  
  // Rain is rare (20% chance)
  const isRainy = Math.random() < 0.20;
  
  if (isTwilight) {
    return {
      timeOfDay: 'night',
      weather: isRainy ? 'rain' : 'clear',
      skyColor: isRainy ? '#4a4a6b' : '#6a5acd',
      ambientIntensity: 0.6,
      directionalIntensity: 0.8,
      trackColor: isRainy ? '#5d4e37' : '#8B4513',
      grassColor: isRainy ? '#2d5a2d' : '#228b22'
    };
  } else {
    return {
      timeOfDay: 'day',
      weather: isRainy ? 'rain' : 'clear',
      skyColor: isRainy ? '#6b7280' : '#87ceeb',
      ambientIntensity: 0.4,
      directionalIntensity: isRainy ? 0.7 : 1.0,
      trackColor: isRainy ? '#5d4e37' : '#8B4513',
      grassColor: isRainy ? '#2d5a2d' : '#32cd32'
    };
  }
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
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));
    
    return geometry;
  }, []);
  
  useFrame(() => {
    if (!isRaining || !rainRef.current) return;
    
    const positions = rainRef.current.geometry.attributes.position.array as Float32Array;
    const velocities = rainRef.current.geometry.attributes.velocity.array as Float32Array;
    
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
      <pointsMaterial
        color="#87ceeb"
        size={0.1}
        transparent
        opacity={0.6}
      />
    </points>
  );
}

// Camera that follows the leading horse
function FollowCamera({ leadingHorse, isRacing, raceState }: { leadingHorse: any, isRacing: boolean, raceState: string }) {
  const trackLength = 200;
  const raceDistance = 1200;
  
  // Camera target position and rotation
  const [targetPosition, setTargetPosition] = useState({ x: -trackLength / 2, y: 12, z: 20 });
  const [targetLookAt, setTargetLookAt] = useState({ x: -trackLength / 2, y: 0, z: 0 });
  
  // Smooth the leading horse position to prevent jitter
  const [smoothLeadingPosition, setSmoothLeadingPosition] = useState(0);
  
  // Update smooth leading position
  useFrame(() => {
    if (leadingHorse && leadingHorse.position !== undefined) {
      setSmoothLeadingPosition(prev => 
        THREE.MathUtils.lerp(prev, leadingHorse.position, 0.08) // Reduced from 0.18 to 0.08 for smoother tracking
      );
    }
  });
  
  // Update camera target based on race state and leading horse
  useEffect(() => {
    if (raceState === 'countdown' || raceState === 'ready' || raceState === 'waiting' || raceState === 'pre-race') {
      // Position at start line looking at the barriers during countdown, waiting, and pre-race
      setTargetPosition({ x: -trackLength / 2, y: 7, z: 18 }); // Raised from y: 5 to y: 7
      setTargetLookAt({ x: -trackLength / 2, y: 1, z: 0 });
    } else if (isRacing && leadingHorse) {
      // Perfect side view following the leading horse - zoomed in
      const progressRatio = smoothLeadingPosition / raceDistance;
      const horseX = -trackLength / 2 + (progressRatio * trackLength);
      
      // Camera positioned directly to the side of the leading horse - closer
      setTargetPosition({ 
        x: horseX,        // Follow horse exactly on X-axis
        y: 8,             // Raised from y: 6 to y: 8 for slightly higher view
        z: 20             // Side view distance
      });
      setTargetLookAt({ 
        x: horseX,        // Look at the horse's exact X position
        y: 1,             // Keep at y: 1 for slight upward angle
        z: 0              // Center of the track for perfect side view
      }); 
    } else if (raceState === 'finished') {
      // Move to finish line for results - zoomed in
      setTargetPosition({ x: trackLength / 2 - 18, y: 7, z: 20 }); // Raised from y: 5 to y: 7
      setTargetLookAt({ x: trackLength / 2, y: 1, z: 0 });
    } else {
      // Default overview position - zoomed in
      setTargetPosition({ x: 0, y: 8, z: 20 }); // Raised from y: 6 to y: 8
      setTargetLookAt({ x: 0, y: 1, z: 0 });
    }
  }, [smoothLeadingPosition, isRacing, raceState, trackLength, raceDistance]);

  // Smooth camera interpolation
  useFrame(({ camera }) => {
    if (camera && targetPosition && targetLookAt) {
      // Ultra-fast interpolation for incredible responsiveness
      const lerpFactor = 0.25; // Increased from 0.15 to 0.25 for incredible responsiveness
      
      // Smoothly interpolate camera position
      camera.position.lerp(
        new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z),
        lerpFactor
      );
      
      // Smoothly interpolate camera look-at target
      const currentLookAt = new THREE.Vector3();
      camera.getWorldDirection(currentLookAt);
      currentLookAt.add(camera.position);
      
      const newLookAt = new THREE.Vector3(targetLookAt.x, targetLookAt.y, targetLookAt.z);
      currentLookAt.lerp(newLookAt, lerpFactor);
      
      camera.lookAt(currentLookAt);
    }
  });

  return null;
}

// Starting gates/barriers
function StartingGates({ trackWidth, numHorses }: { trackWidth: number, numHorses: number }) {
  const gates = [];
  const laneWidth = trackWidth / numHorses;
  
  for (let i = 0; i < numHorses; i++) {
    const laneCenter = -trackWidth / 2 + (i + 0.5) * laneWidth;
    
    gates.push(
      <group key={`gate-${i}`} position={[-98, 0, laneCenter]}>
        {/* Gate posts */}
        <mesh position={[0, 2, -laneWidth/4]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 4]} />
          <meshLambertMaterial color="#8B4513" />
        </mesh>
        <mesh position={[0, 2, laneWidth/4]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 4]} />
          <meshLambertMaterial color="#8B4513" />
        </mesh>
        
        {/* Gate barrier */}
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[0.2, 2, laneWidth/2]} />
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
      </group>
    );
  }
  
  return <>{gates}</>;
}

// Grandstand with spectators
function Grandstand() {
  const spectators = [];
  
  // Create rows of spectators
  for (let row = 0; row < 5; row++) {
    for (let seat = 0; seat < 20; seat++) {
      spectators.push(
        <mesh
          key={`spectator-${row}-${seat}`}
          position={[
            -80 + seat * 8,
            2 + row * 1.5,
            -25 - row * 2
          ]}
          castShadow
        >
          <sphereGeometry args={[0.3]} />
          <meshLambertMaterial color={`hsl(${Math.random() * 360}, 70%, 50%)`} />
        </mesh>
      );
    }
  }
  
  return (
    <group>
      {/* Grandstand structure */}
      <mesh position={[0, 5, -35]} castShadow>
        <boxGeometry args={[180, 10, 20]} />
        <meshLambertMaterial color="#CCCCCC" />
      </mesh>
      
      {/* Spectators */}
      {spectators}
      
      {/* Grandstand roof */}
      <mesh position={[0, 12, -35]} castShadow>
        <boxGeometry args={[190, 2, 25]} />
        <meshLambertMaterial color="#444444" />
      </mesh>
    </group>
  );
}

// Smooth horse component with interpolated movement
function SmoothHorse({ 
  horse, 
  targetX, 
  laneOffset, 
  position, 
  isRacing,
  index
}: { 
  horse: any, 
  targetX: number, 
  laneOffset: number, 
  position: number, 
  isRacing: boolean,
  index: number
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [currentX, setCurrentX] = useState(targetX);
  const [smoothPosition, setSmoothPosition] = useState(position);

  useFrame(() => {
    if (groupRef.current) {
      // Buttery smooth interpolation for horse position
      const newX = THREE.MathUtils.lerp(currentX, targetX, 0.03); // Reduced from 0.05 to 0.03
      setCurrentX(newX);
      groupRef.current.position.x = newX;
      
      // Smooth the position value for display
      setSmoothPosition(prev => THREE.MathUtils.lerp(prev, position, 0.03)); // Reduced from 0.05 to 0.03
    }
  });

  return (
    <group ref={groupRef} position={[currentX, 1, laneOffset]}>
      {/* Horse body */}
      <mesh castShadow>
        <boxGeometry args={[1.5, 1, 0.8]} />
        <meshLambertMaterial color={horse.color || "#8B4513"} />
      </mesh>
      
      {/* Horse head */}
      <mesh position={[0.8, 0.3, 0]} castShadow>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshLambertMaterial color={horse.color || "#8B4513"} />
      </mesh>
      
      {/* Legs with running animation - smoother animation */}
      {[-0.4, 0.4].map((legX, legIndex) =>
        [-0.3, 0.3].map((legZ, legZIndex) => (
          <mesh
            key={`leg-${legIndex}-${legZIndex}`}
            position={[
              legX, 
              -0.8 + (isRacing ? Math.sin(Date.now() * 0.015 + legIndex + legZIndex) * 0.08 : 0), // Smoother leg animation
              legZ
            ]}
            castShadow
          >
            <cylinderGeometry args={[0.1, 0.1, 0.6]} />
            <meshLambertMaterial color="#654321" />
          </mesh>
        ))
      )}
      
      {/* Jockey */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <sphereGeometry args={[0.3]} />
        <meshLambertMaterial color="#FF6B6B" />
      </mesh>
      
      {/* Horse name and number label */}
      <Text
        position={[-2.5, 0.3, 0]}
        rotation={[0, 0, 0]}
        fontSize={0.4}
        color={"#FFFFFF"}
        anchorX={"right"}
        anchorY={"middle"}
      >
        #{horse.lane || index + 1} {horse.name}
      </Text>
      
      {/* Position indicator - using smooth position */}
      <Text
        position={[-2.5, -0.1, 0]}
        rotation={[0, 0, 0]}
        fontSize={0.3}
        color={"#FFFF00"}
        anchorX={"right"}
        anchorY={"middle"}
      >
        {Math.round(smoothPosition)}m
      </Text>
    </group>
  );
}

export default function RaceTrack({ progress = [], isRacing = false, raceState = 'waiting' }: RaceTrackProps) {
  // Track dimensions - properly scaled for 1200m race
  const trackLength = 200;
  const trackWidth = 16;
  const numHorses = Math.max(progress.length, 8);

  // Generate weather conditions once per race - only reset when explicitly going back to waiting
  const weatherConditions = useMemo(() => generateWeatherConditions(), [raceState === 'waiting']);

  return (
    <div 
      className="w-full h-full transition-colors duration-1000 relative"
      style={{ 
        background: `linear-gradient(to bottom, ${weatherConditions.skyColor}, ${weatherConditions.skyColor}dd)` 
      }}
    >
      {/* Weather overlay indicator - top right corner */}
      <div className="absolute top-4 right-4 z-10 bg-black/50 rounded-lg p-3 text-white">
        <div className="flex items-center gap-2 text-lg">
          <span>{weatherConditions.timeOfDay === 'night' ? '🌅' : '☀️'}</span>
          <span>{weatherConditions.weather === 'rain' ? '💧' : '☀️'}</span>
        </div>
        <div className="text-xs text-center mt-1">
          {weatherConditions.weather === 'rain' ? 'WET TRACK' : 'DRY TRACK'}
        </div>
        <div className="text-xs text-center text-gray-300">
          {weatherConditions.timeOfDay === 'night' ? 'TWILIGHT' : 'DAYTIME'}
        </div>
      </div>

      <Canvas shadows camera={{ near: 0.5, far: 2000, fov: 50 }}>
        {/* Custom camera that follows leading horse */}
        <FollowCamera leadingHorse={progress.length > 0 ? progress.reduce((prev, current) => 
          (current.position > prev.position) ? current : prev
        ) : null} isRacing={isRacing} raceState={raceState} />
        
        {/* Dynamic Lighting based on time of day */}
        <ambientLight intensity={weatherConditions.ambientIntensity} />
        <directionalLight
          position={weatherConditions.timeOfDay === 'night' ? [30, 30, 30] : [50, 50, 50]}
          intensity={weatherConditions.directionalIntensity}
          color={weatherConditions.timeOfDay === 'night' ? '#ffa500' : '#ffffff'}
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
        {weatherConditions.timeOfDay === 'night' && (
          <>
            {/* Warm twilight lights */}
            <pointLight position={[-50, 20, -20]} intensity={0.4} color="#ff6347" />
            <pointLight position={[0, 20, -20]} intensity={0.4} color="#ffa500" />
            <pointLight position={[50, 20, -20]} intensity={0.4} color="#ff6347" />
            <pointLight position={[-50, 20, 20]} intensity={0.4} color="#ffa500" />
            <pointLight position={[0, 20, 20]} intensity={0.4} color="#ff6347" />
            <pointLight position={[50, 20, 20]} intensity={0.4} color="#ffa500" />
          </>
        )}

        {/* Rain Effect */}
        <RainEffect isRaining={weatherConditions.weather === 'rain'} />

        {/* Track surface with green grass lanes */}
        <group>
          {/* Main track base */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[trackLength, trackWidth]} />
            <meshLambertMaterial color={weatherConditions.trackColor} />
          </mesh>

          {/* Green grass lanes */}
          {Array.from({ length: numHorses }, (_, i) => {
            const laneWidth = trackWidth / numHorses;
            const laneCenter = -trackWidth / 2 + (i + 0.5) * laneWidth;
            
            return (
              <mesh 
                key={`grass-lane-${i}`}
                rotation={[-Math.PI / 2, 0, 0]} 
                position={[0, 0.01, laneCenter]} 
                receiveShadow
              >
                <planeGeometry args={[trackLength, laneWidth * 0.8]} />
                <meshLambertMaterial 
                  color={weatherConditions.grassColor}
                  transparent
                  opacity={0.9}
                />
              </mesh>
            );
          })}
        </group>

        {/* Track borders */}
        <mesh position={[0, 0.1, trackWidth / 2 + 0.5]} castShadow>
          <boxGeometry args={[trackLength, 0.2, 1]} />
          <meshLambertMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[0, 0.1, -trackWidth / 2 - 0.5]} castShadow>
          <boxGeometry args={[trackLength, 0.2, 1]} />
          <meshLambertMaterial color="#FFFFFF" />
        </mesh>

        {/* Lane dividers */}
        {Array.from({ length: numHorses - 1 }, (_, i) => {
          const lanePosition = -trackWidth / 2 + ((i + 1) * trackWidth) / numHorses;
          return (
            <mesh key={`lane-${i}`} position={[0, 0.05, lanePosition]} castShadow>
              <boxGeometry args={[trackLength, 0.1, 0.1]} />
              <meshLambertMaterial color="#FFFFFF" />
            </mesh>
          );
        })}

        {/* Starting line */}
        <group position={[-trackLength / 2, 0, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <planeGeometry args={[0.5, trackWidth]} />
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
        <group position={[trackLength / 2, 0, 0]}>
          {/* Checkered finish line */}
          {Array.from({ length: 20 }, (_, i) => (
            <mesh
              key={`checker-${i}`}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[
                0,
                0.03,
                -trackWidth / 2 + (i * trackWidth) / 20 + trackWidth / 40,
              ]}
            >
              <planeGeometry args={[0.5, trackWidth / 20]} />
              <meshBasicMaterial color={i % 2 === 0 ? "#FFFFFF" : "#000000"} />
            </mesh>
          ))}

          {/* Finish line posts */}
          <mesh position={[0, 3, -trackWidth / 2 - 1]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 6]} />
            <meshLambertMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[0, 3, trackWidth / 2 + 1]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 6]} />
            <meshLambertMaterial color="#FFFFFF" />
          </mesh>

          {/* Checkered flags */}
          <mesh position={[-0.5, 4, -trackWidth / 2 - 1]} rotation={[0, 0, 0.3]}>
            <planeGeometry args={[1.5, 1]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          <mesh position={[-0.5, 4, trackWidth / 2 + 1]} rotation={[0, 0, -0.3]}>
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
        <StartingGates trackWidth={trackWidth} numHorses={numHorses} />

        {/* Grandstand */}
        <Grandstand />

        {/* 3D Horses */}
        {progress.map((horseProgress, index) => {
          // Handle different data structures
          const horse = horseProgress?.horse || horseProgress;
          const position = horseProgress?.position || 0;
          
          if (!horse || !horse.name) return null;
          
          // Map race progress (0-1200m) to 3D track (-100 to +100)
          const raceDistance = 1200;
          const progressRatio = position / raceDistance;
          const targetX = -trackLength / 2 + (progressRatio * trackLength);
          
          // Calculate lane position using horse's actual lane assignment
          const laneWidth = trackWidth / numHorses;
          const actualLane = horse.lane || (index + 1); // Use horse's lane or fallback to index + 1
          const laneOffset = -trackWidth / 2 + (actualLane - 0.5) * laneWidth; // actualLane - 0.5 because lanes are 1-indexed

          return (
            <SmoothHorse
              key={horse.id || index}
              horse={horse}
              targetX={targetX}
              laneOffset={laneOffset}
              position={position}
              isRacing={isRacing}
              index={actualLane - 1} // Pass the correct lane index for display
            />
          );
        })}

        {/* Ground plane with dynamic grass color */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[300, 100]} />
          <meshLambertMaterial color={weatherConditions.grassColor} />
        </mesh>
      </Canvas>
    </div>
  );
}