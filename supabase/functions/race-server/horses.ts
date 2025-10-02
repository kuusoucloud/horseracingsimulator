// Horse generation for server-side racing with proper ELO-based odds
interface Horse {
  id: string;
  name: string;
  elo: number;
  odds: number;
  lane: number;
}

// Comprehensive horse database - matches client-side database
const HORSE_DATABASE = [
  { name: "Thunder Strike", elo: 500 },
  { name: "Lightning Bolt", elo: 500 },
  { name: "Storm Chaser", elo: 500 },
  { name: "Fire Storm", elo: 500 },
  { name: "Golden Arrow", elo: 500 },
  { name: "Silver Bullet", elo: 500 },
  { name: "Midnight Express", elo: 500 },
  { name: "Royal Thunder", elo: 500 },
  { name: "Diamond Dash", elo: 500 },
  { name: "Crimson Flash", elo: 500 },
  { name: "Blazing Glory", elo: 500 },
  { name: "Wind Walker", elo: 500 },
  { name: "Star Gazer", elo: 500 },
  { name: "Moon Runner", elo: 500 },
  { name: "Sun Dancer", elo: 500 },
  { name: "Ocean Breeze", elo: 500 },
  { name: "Mountain Peak", elo: 500 },
  { name: "Desert Wind", elo: 500 },
  { name: "Forest Fire", elo: 500 },
  { name: "River Rush", elo: 500 },
  { name: "Eagle Eye", elo: 500 },
  { name: "Falcon Flight", elo: 500 },
  { name: "Phoenix Rising", elo: 500 },
  { name: "Dragon Heart", elo: 500 },
  { name: "Tiger Stripe", elo: 500 },
  { name: "Brave Spirit", elo: 500 },
  { name: "Wild Mustang", elo: 500 },
  { name: "Free Runner", elo: 500 },
  { name: "Swift Arrow", elo: 500 },
  { name: "Noble Knight", elo: 500 },
  { name: "Gentle Giant", elo: 500 },
  { name: "Proud Warrior", elo: 500 },
  { name: "Silent Storm", elo: 500 },
  { name: "Dancing Queen", elo: 500 },
  { name: "Singing Bird", elo: 500 },
  { name: "Flying Fish", elo: 500 },
  { name: "Jumping Jack", elo: 500 },
  { name: "Running Bear", elo: 500 },
  { name: "Climbing Cat", elo: 500 },
  { name: "Swimming Swan", elo: 500 },
  { name: "Soaring Hawk", elo: 500 },
  { name: "Roaring Lion", elo: 500 },
  { name: "Howling Wolf", elo: 500 },
  { name: "Barking Dog", elo: 500 },
  { name: "Meowing Mouse", elo: 500 },
  { name: "Lucky Charm", elo: 500 },
  { name: "Magic Wand", elo: 500 },
  { name: "Crystal Ball", elo: 500 },
  { name: "Shooting Star", elo: 500 },
  { name: "Wishing Well", elo: 500 }
];

function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Get stored ELO ratings from horses table
async function getStoredEloRatings(supabaseClient: any): Promise<Record<string, number>> {
  try {
    const { data: horses, error } = await supabaseClient
      .from('horses')
      .select('name, elo');
    
    if (error) {
      console.error('❌ Error fetching horse ELOs:', error);
      return {};
    }
    
    const eloMap: Record<string, number> = {};
    horses?.forEach((horse: any) => {
      eloMap[horse.name] = horse.elo || 500;
    });
    
    return eloMap;
  } catch (error) {
    console.error('❌ Error in getStoredEloRatings:', error);
    return {};
  }
}

// Get current ELO for a horse (500 if not found)
function getHorseElo(horseName: string, storedRatings: Record<string, number>): number {
  return storedRatings[horseName] || 500;
}

// Calculate balanced odds based on ELO ratings of all horses in the race
function calculateOddsFromELO(horses: { name: string; elo: number }[]): { name: string; odds: number }[] {
  // Sort horses by ELO descending to ensure proper ranking
  const sortedHorses = [...horses].sort((a, b) => b.elo - a.elo);
  
  // Calculate relative strength based on ELO differences
  const probabilities = sortedHorses.map(horse => {
    // Calculate this horse's strength relative to all others
    let totalStrength = 0;
    let thisHorseStrength = 0;
    
    sortedHorses.forEach(h => {
      // Use exponential scaling to make ELO differences dramatic but fair
      const strength = Math.pow(10, h.elo / 400); // Chess-like ELO scaling
      totalStrength += strength;
      if (h.name === horse.name) {
        thisHorseStrength = strength;
      }
    });
    
    // Base probability from relative strength
    let probability = thisHorseStrength / totalStrength;
    
    // Apply balanced tier-based multipliers
    if (horse.elo >= 2000) {
      probability *= 1.4; // Mythical boost
    } else if (horse.elo >= 1800) {
      probability *= 1.3; // Legendary boost
    } else if (horse.elo >= 1600) {
      probability *= 1.2; // Champion boost
    } else if (horse.elo >= 1400) {
      probability *= 1.1; // Elite boost
    } else if (horse.elo < 1000) {
      probability *= 0.8; // Weak penalty
    } else if (horse.elo < 800) {
      probability *= 0.6; // Very weak penalty
    }
    
    return { name: horse.name, probability: Math.max(0.01, probability) };
  });
  
  // Normalize probabilities to ensure they sum to 1
  const totalProb = probabilities.reduce((sum, p) => sum + p.probability, 0);
  const normalizedProbs = probabilities.map(p => ({
    name: p.name,
    probability: p.probability / totalProb
  }));
  
  // Convert to fair odds with minimal house edge (2%)
  return normalizedProbs.map(p => {
    const adjustedProb = p.probability * 0.98; // 2% house edge
    let odds = 1 / adjustedProb;
    
    // Round odds appropriately for better UX
    if (odds < 1.5) {
      odds = Math.round(odds * 100) / 100; // 2 decimal places for favorites
    } else if (odds < 5) {
      odds = Math.round(odds * 20) / 20; // 0.05 increments
    } else if (odds < 15) {
      odds = Math.round(odds * 10) / 10; // 0.1 increments
    } else if (odds < 50) {
      odds = Math.round(odds * 2) / 2; // 0.5 increments
    } else {
      odds = Math.round(odds); // Whole numbers for longshots
    }
    
    return {
      name: p.name,
      odds: Math.max(1.01, Math.min(999, odds)) // Reasonable bounds
    };
  });
}

// Generate random horses with weighted selection based on ELO tiers
function getRandomHorses(count: number = 8): { name: string; elo: number }[] {
  // Create weighted selection based on ELO tiers for variety
  const weightedHorses = HORSE_DATABASE.map(horse => {
    let weight: number;
    
    // All horses start at 500 ELO, but we want variety in selection
    // This creates natural ELO distribution over time
    if (horse.elo >= 2000) {
      weight = 1; // Rare
    } else if (horse.elo >= 1800) {
      weight = 2; // Uncommon
    } else if (horse.elo >= 1600) {
      weight = 5; // Less common
    } else if (horse.elo >= 1400) {
      weight = 10; // Moderate
    } else if (horse.elo >= 1200) {
      weight = 15; // Common
    } else if (horse.elo >= 1000) {
      weight = 12; // Common
    } else {
      weight = 8; // Less common (very weak horses)
    }
    
    return { horse, weight };
  });
  
  // Create weighted selection pool
  const selectionPool: { name: string; elo: number }[] = [];
  weightedHorses.forEach(({ horse, weight }) => {
    for (let i = 0; i < weight; i++) {
      selectionPool.push(horse);
    }
  });
  
  // Randomly select unique horses
  const selectedHorses: { name: string; elo: number }[] = [];
  const usedHorses = new Set<string>();
  
  while (selectedHorses.length < count && selectedHorses.length < HORSE_DATABASE.length) {
    const randomIndex = Math.floor(Math.random() * selectionPool.length);
    const selectedHorse = selectionPool[randomIndex];
    
    if (!usedHorses.has(selectedHorse.name)) {
      selectedHorses.push(selectedHorse);
      usedHorses.add(selectedHorse.name);
    }
  }
  
  return selectedHorses;
}

export async function generateRandomHorses(count: number = 8, supabaseClient: any): Promise<Horse[]> {
  // Get current ELO ratings from database
  const storedRatings = await getStoredEloRatings(supabaseClient);
  
  // Select random horses
  const randomHorses = getRandomHorses(count);
  
  // Use current ELO ratings instead of static database values
  const horsesWithCurrentElo = randomHorses.map(horse => ({
    ...horse,
    elo: getHorseElo(horse.name, storedRatings)
  }));
  
  // Calculate fair odds based on relative ELO strengths
  const oddsData = calculateOddsFromELO(horsesWithCurrentElo);
  
  // Create final horse objects
  return horsesWithCurrentElo.map((horse, index) => {
    const odds = oddsData.find(o => o.name === horse.name)?.odds || 5.0;
    
    return {
      id: generateRandomId(),
      name: horse.name,
      elo: horse.elo,
      odds: odds,
      lane: index + 1
    };
  });
}