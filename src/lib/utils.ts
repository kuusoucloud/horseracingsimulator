import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Horse ranking system based on ELO ratings
export interface HorseRank {
  name: string;
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

export function getHorseRank(elo: number): HorseRank {
  if (elo >= 2000) {
    return {
      name: "Mythical",
      color: "#FF1493", // Deep Pink with gold shimmer effect
      textColor: "text-pink-400",
      bgColor: "bg-gradient-to-r from-pink-500/20 to-yellow-500/20",
      borderColor: "border-pink-400/60"
    };
  } else if (elo >= 1900) {
    return {
      name: "Legendary",
      color: "#FFD700", // Gold
      textColor: "text-yellow-400",
      bgColor: "bg-gradient-to-r from-yellow-500/20 to-orange-500/20",
      borderColor: "border-yellow-400/50"
    };
  } else if (elo >= 1800) {
    return {
      name: "Champion",
      color: "#FF8C00", // Dark Orange
      textColor: "text-orange-400",
      bgColor: "bg-orange-500/20",
      borderColor: "border-orange-400/50"
    };
  } else if (elo >= 1700) {
    return {
      name: "Elite",
      color: "#9370DB", // Medium Purple
      textColor: "text-purple-400",
      bgColor: "bg-purple-500/20",
      borderColor: "border-purple-400/50"
    };
  } else if (elo >= 1600) {
    return {
      name: "Expert",
      color: "#4169E1", // Royal Blue
      textColor: "text-blue-400",
      bgColor: "bg-blue-500/20",
      borderColor: "border-blue-400/50"
    };
  } else if (elo >= 1500) {
    return {
      name: "Skilled",
      color: "#00CED1", // Dark Turquoise
      textColor: "text-cyan-400",
      bgColor: "bg-cyan-500/20",
      borderColor: "border-cyan-400/50"
    };
  } else if (elo >= 1400) {
    return {
      name: "Competent",
      color: "#32CD32", // Lime Green
      textColor: "text-green-400",
      bgColor: "bg-green-500/20",
      borderColor: "border-green-400/50"
    };
  } else if (elo >= 1300) {
    return {
      name: "Promising",
      color: "#FFFF00", // Yellow
      textColor: "text-yellow-300",
      bgColor: "bg-yellow-500/15",
      borderColor: "border-yellow-400/40"
    };
  } else if (elo >= 1200) {
    return {
      name: "Developing",
      color: "#FFA500", // Orange
      textColor: "text-orange-300",
      bgColor: "bg-orange-500/15",
      borderColor: "border-orange-400/40"
    };
  } else if (elo >= 1000) {
    return {
      name: "Novice",
      color: "#FF6347", // Tomato
      textColor: "text-red-300",
      bgColor: "bg-red-500/15",
      borderColor: "border-red-400/40"
    };
  } else {
    return {
      name: "Rookie",
      color: "#DC143C", // Crimson
      textColor: "text-red-400",
      bgColor: "bg-red-500/20",
      borderColor: "border-red-400/50"
    };
  }
}

// Barrier/Lane color system - traditional racing colors
export function getBarrierColor(lane: number): string {
  const barrierColors = [
    '#FF0000', // Lane 1 - Red
    '#0000FF', // Lane 2 - Blue  
    '#FFFFFF', // Lane 3 - White
    '#FFFF00', // Lane 4 - Yellow
    '#00FF00', // Lane 5 - Green
    '#FFA500', // Lane 6 - Orange
    '#800080', // Lane 7 - Purple
    '#FFC0CB', // Lane 8 - Pink
  ];
  
  return barrierColors[(lane - 1) % barrierColors.length] || '#FF0000';
}