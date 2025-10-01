export interface Horse {
  id: string;
  name: string;
  speed: number;
  stamina: number;
  acceleration: number;
  odds: number;
  color: string;
  elo: number; // Added ELO rating
  description?: string; // Added description field
  sprintStartPercent?: number; // When the horse starts their final sprint (40-75%)
  earlyAdvantage?: number; // Early race speed multiplier
  isEarlyRunner?: boolean; // Whether this horse performs well early
  lane?: number; // Lane assignment
  position?: number; // Current race position (0-1200m)
}

export interface RaceProgress {
  id: string;
  name: string;
  position: number;
  speed: number;
}

export interface Bet {
  horseId: string;
  horseName: string;
  amount: number;
  odds: number;
}

export interface RaceResult {
  id: string;
  horse?: Horse;
  name: string;
  position: number;
  placement: number;
  finishTime: number;
  lane: number; // Added missing lane field
  odds: number;
  gap: string;
  eloChange?: {
    before: number;
    after: number;
    change: number;
  };
}

export type RaceState = "pre-race" | "countdown" | "racing" | "finished";