export interface Horse {
  id: string;
  name: string;
  speed: number;
  stamina: number;
  acceleration: number;
  odds: number;
  color: string;
  elo: number; // Added ELO rating
  sprintStartPercent?: number; // When the horse starts their final sprint (40-75%)
  earlyAdvantage?: number; // Early race speed multiplier
  isEarlyRunner?: boolean; // Whether this horse performs well early
  lane?: number; // Lane assignment
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
  horse: Horse;
  position: number;
  finishTime: number;
  gap: string;
}

export type RaceState = "pre-race" | "countdown" | "racing" | "finished";