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
  if (elo >= 1900) {
    return {
      name: "Legendary",
      color: "#FFD700", // Gold
      textColor: "text-yellow-400",
      bgColor: "bg-yellow-500/20",
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