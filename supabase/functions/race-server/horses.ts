// Horse generation for server-side racing
interface Horse {
  id: string;
  name: string;
  elo: number;
  odds: number;
  lane: number;
}

const HORSE_NAMES = [
  "Thunder Bolt", "Lightning Strike", "Storm Chaser", "Wind Runner", "Fire Spirit",
  "Golden Arrow", "Silver Bullet", "Midnight Express", "Dawn Breaker", "Star Gazer",
  "Wild Mustang", "Desert Storm", "Ocean Wave", "Mountain Peak", "Forest Fire",
  "Crimson Flash", "Azure Dream", "Emerald Knight", "Ruby Racer", "Diamond Dash",
  "Blazing Comet", "Shooting Star", "Cosmic Rider", "Galaxy Gallop", "Nebula Sprint",
  "Phoenix Rising", "Dragon Fury", "Eagle Soar", "Falcon Flight", "Hawk Eye",
  "Thunder Cloud", "Lightning Bolt", "Storm Rider", "Wind Walker", "Fire Dancer",
  "Golden Eagle", "Silver Fox", "Midnight Runner", "Dawn Patrol", "Star Striker",
  "Wild Spirit", "Desert Wind", "Ocean Breeze", "Mountain Thunder", "Forest Runner",
  "Crimson Tide", "Azure Sky", "Emerald Fire", "Ruby Thunder", "Diamond Storm"
];

function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function getRandomName(): string {
  return HORSE_NAMES[Math.floor(Math.random() * HORSE_NAMES.length)];
}

function generateRandomElo(): number {
  // Generate ELO ratings with realistic distribution
  // Most horses around 1000-1400, some exceptional ones higher/lower
  const rand = Math.random();
  
  if (rand < 0.1) {
    // 10% chance of very low ELO (400-800)
    return Math.floor(400 + Math.random() * 400);
  } else if (rand < 0.8) {
    // 70% chance of average ELO (800-1400)
    return Math.floor(800 + Math.random() * 600);
  } else if (rand < 0.95) {
    // 15% chance of high ELO (1400-1800)
    return Math.floor(1400 + Math.random() * 400);
  } else {
    // 5% chance of exceptional ELO (1800-2100)
    return Math.floor(1800 + Math.random() * 300);
  }
}

function calculateOdds(elo: number): number {
  // Convert ELO to betting odds
  // Higher ELO = lower odds (more likely to win)
  const normalized = Math.max(0, Math.min(1, (elo - 400) / 1700));
  const baseOdds = 1.2 + (1 - normalized) * 8.8; // Range: 1.2 to 10.0
  return Math.round(baseOdds * 10) / 10; // Round to 1 decimal place
}

export function generateRandomHorses(count: number = 8): Horse[] {
  const horses: Horse[] = [];
  const usedNames = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    let name = getRandomName();
    
    // Ensure unique names
    while (usedNames.has(name)) {
      name = getRandomName();
    }
    usedNames.add(name);
    
    const elo = generateRandomElo();
    const odds = calculateOdds(elo);
    
    horses.push({
      id: generateRandomId(),
      name,
      elo,
      odds,
      lane: i + 1
    });
  }
  
  return horses;
}