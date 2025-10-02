import { Horse } from '../types/horse';

// Define HorseData interface for the database
interface HorseData {
  name: string;
  elo: number;
}

// ELO Rating System
export const STARTING_ELO = 500;
const K_FACTOR_PODIUM = 192; // Increased K-factor for podium finishers (1st, 2nd, 3rd)
const K_FACTOR_OTHERS = 32; // Standard K-factor for others

// Storage Keys
const ELO_STORAGE_KEY = 'horseEloRatings';
const HORSE_STATS_STORAGE_KEY = 'horseStatistics';

// Horse Statistics Interface
interface HorseStats {
  wins: number;
  totalRaces: number;
  recentForm: number[]; // Last 5 race placements
}

// Get stored horse statistics
export const getStoredHorseStats = (): { [horseName: string]: HorseStats } => {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(HORSE_STATS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error loading horse statistics:', error);
    return {};
  }
};

// Save horse statistics
const saveHorseStats = (stats: { [horseName: string]: HorseStats }) => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(HORSE_STATS_STORAGE_KEY, JSON.stringify(stats));
    console.log('📊 Horse statistics saved:', stats);
  } catch (error) {
    console.error('Error saving horse statistics:', error);
  }
};

// Update horse statistics after a race
export const updateHorseStats = (raceResults: { name: string; placement: number }[]) => {
  console.log('📈 Updating horse statistics for race results:', raceResults);
  
  const currentStats = getStoredHorseStats();
  
  raceResults.forEach(({ name, placement }) => {
    // Initialize stats if horse doesn't exist
    if (!currentStats[name]) {
      currentStats[name] = {
        wins: 0,
        totalRaces: 0,
        recentForm: []
      };
    }
    
    const horseStats = currentStats[name];
    
    // Update wins if 1st place
    if (placement === 1) {
      horseStats.wins += 1;
      console.log(`🏆 ${name} wins updated: ${horseStats.wins}`);
    }
    
    // Update total races
    horseStats.totalRaces += 1;
    
    // Update recent form (keep last 5 races)
    horseStats.recentForm.unshift(placement);
    if (horseStats.recentForm.length > 5) {
      horseStats.recentForm = horseStats.recentForm.slice(0, 5);
    }
    
    console.log(`📊 ${name} stats updated:`, horseStats);
  });
  
  saveHorseStats(currentStats);
  console.log('💾 Horse statistics updated and saved!');
};

// Get stored ELO ratings from localStorage
export function getStoredEloRatings(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(ELO_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error loading ELO ratings:', error);
    return {};
  }
}

// Save ELO ratings to localStorage
function saveEloRatings(ratings: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(ELO_STORAGE_KEY, JSON.stringify(ratings));
    console.log('💾 ELO ratings saved:', ratings);
  } catch (error) {
    console.error('Error saving ELO ratings:', error);
  }
}

// Get current ELO for a horse (500 if not found)
export function getHorseElo(horseName: string): number {
  const storedRatings = getStoredEloRatings();
  return storedRatings[horseName] || STARTING_ELO;
}

// Update ELO ratings after a race
export function updateEloRatings(raceResults: { name: string; placement: number }[]) {
  console.log('🏁 Updating ELO ratings for race results:', raceResults);
  
  const currentRatings = getStoredEloRatings();
  const updatedRatings = { ...currentRatings };
  
  // Initialize ratings for new horses
  raceResults.forEach(({ name }) => {
    if (!updatedRatings[name]) {
      updatedRatings[name] = STARTING_ELO;
      console.log(`🆕 New horse ${name} initialized with ELO: ${STARTING_ELO}`);
    }
  });
  
  // Calculate ELO changes for each pair of horses
  for (let i = 0; i < raceResults.length; i++) {
    for (let j = i + 1; j < raceResults.length; j++) {
      const horse1 = raceResults[i];
      const horse2 = raceResults[j];
      
      const rating1 = updatedRatings[horse1.name];
      const rating2 = updatedRatings[horse2.name];
      
      // Expected scores based on ELO difference
      const expected1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
      const expected2 = 1 / (1 + Math.pow(10, (rating1 - rating2) / 400));
      
      // Actual scores (horse1 finished ahead of horse2)
      const actual1 = 1;
      const actual2 = 0;
      
      // Determine K-factors based on podium placement
      const k1 = horse1.placement <= 3 ? K_FACTOR_PODIUM : K_FACTOR_OTHERS;
      const k2 = horse2.placement <= 3 ? K_FACTOR_PODIUM : K_FACTOR_OTHERS;
      
      // Calculate new ratings
      const newRating1 = rating1 + k1 * (actual1 - expected1);
      const newRating2 = rating2 + k2 * (actual2 - expected2);
      
      updatedRatings[horse1.name] = Math.max(100, newRating1); // Minimum ELO of 100
      updatedRatings[horse2.name] = Math.max(100, newRating2);
    }
  }
  
  // Save updated ratings
  saveEloRatings(updatedRatings);
  
  // Log the changes
  raceResults.forEach(({ name, placement }) => {
    const oldRating = currentRatings[name] || STARTING_ELO;
    const newRating = updatedRatings[name];
    const change = Math.round(newRating - oldRating);
    const kFactor = placement <= 3 ? K_FACTOR_PODIUM : K_FACTOR_OTHERS;
    
    console.log(`📊 ${name} (${placement}${getOrdinalSuffix(placement)}): ${Math.round(oldRating)} → ${Math.round(newRating)} (${change > 0 ? '+' : ''}${change}) [K=${kFactor}]`);
  });
  
  console.log('💾 ELO ratings updated and saved!');
  
  // Trigger a custom event to notify components of ELO updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eloUpdated', { detail: updatedRatings }));
  }
}

// Calculate expected score based on ELO difference
function calculateExpectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

// Calculate actual score based on placement
function calculateActualScore(placement: number, totalHorses: number): number {
  if (placement === 1) return 1.0;      // Winner gets full points
  if (placement === 2) return 0.7;      // 2nd place gets 70%
  if (placement === 3) return 0.5;      // 3rd place gets 50%
  if (placement <= totalHorses / 2) return 0.3; // Top half gets 30%
  return 0.1; // Bottom half gets 10%
}

// Get placement text for logging
function getPlacementText(placement: number): string {
  if (placement === 1) return '1st 🥇';
  if (placement === 2) return '2nd 🥈';
  if (placement === 3) return '3rd 🥉';
  return `${placement}th`;
}

// Reset all ELO ratings to 500 (for testing/reset purposes)
export function resetAllEloRatings(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(ELO_STORAGE_KEY);
  localStorage.removeItem(HORSE_STATS_STORAGE_KEY);
  console.log('🔄 All ELO ratings and horse statistics reset to defaults');
  
  // Trigger a custom event to notify components of ELO reset
  window.dispatchEvent(new CustomEvent('eloReset', { detail: {} }));
}

// Get ELO leaderboard - shows ALL horses with their current ELO ratings
export function getEloLeaderboard(): Array<{ name: string; elo: number }> {
  const storedRatings = getStoredEloRatings();
  
  // If no stored ratings, return empty array
  if (Object.keys(storedRatings).length === 0) {
    return [];
  }
  
  // Convert stored ratings to leaderboard format
  const leaderboardData = Object.entries(storedRatings).map(([name, elo]) => ({
    name,
    elo: Math.round(elo)
  }));
  
  // Sort by ELO descending (highest first)
  return leaderboardData.sort((a, b) => b.elo - a.elo);
}

// Horse coat colors with rarity weights
const HORSE_COLORS = [
  { color: "#8B4513", name: "Brown", weight: 30 }, // Most common
  { color: "#D2B48C", name: "Light Brown", weight: 25 },
  { color: "#654321", name: "Dark Brown", weight: 20 },
  { color: "#2F1B14", name: "Black", weight: 20 },
  { color: "#F5F5DC", name: "White", weight: 5 } // Rare
];

// Generate a static color for a horse based on its name (deterministic)
export function getHorseColor(horseName: string): string {
  // Create a simple hash from the horse name for consistency
  let hash = 0;
  for (let i = 0; i < horseName.length; i++) {
    const char = horseName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use the hash to select a color based on weighted probabilities
  const totalWeight = HORSE_COLORS.reduce((sum, c) => sum + c.weight, 0);
  const randomValue = Math.abs(hash) % totalWeight;
  
  let currentWeight = 0;
  for (const colorData of HORSE_COLORS) {
    currentWeight += colorData.weight;
    if (randomValue < currentWeight) {
      return colorData.color;
    }
  }
  
  // Fallback to brown
  return "#8B4513";
}

// Generate odds-based descriptions (lower odds = bullish, higher odds = bearish)
export function getHorseDescriptionFromOdds(odds: number): string {
  // Use odds value to create a stable seed for consistent descriptions
  const seed = Math.floor(odds * 1000) % 10;
  
  if (odds <= 1.5) {
    // Heavy favorites - very bullish
    const descriptions = [
      "Expected to dominate this race",
      "Clear favorite to win today",
      "Should cruise to victory",
      "Heavily backed for good reason",
      "Will be hard to beat here",
      "Looks unbeatable in this field",
      "Prime position to take the win",
      "Strong chance of wire-to-wire victory",
      "Perfectly suited for this distance",
      "Ready to deliver another win"
    ];
    return descriptions[seed];
  } else if (odds <= 2.5) {
    // Strong favorites - bullish
    const descriptions = [
      "Strong contender for the win",
      "Well-positioned for victory today", 
      "Should be in the mix at the finish",
      "Good chance to take this race",
      "Looks ready to strike gold",
      "Has the class to win here",
      "Primed for a big performance",
      "Could easily take this field",
      "Solid bet for the winner's circle",
      "Expect a strong showing today"
    ];
    return descriptions[seed];
  } else if (odds <= 4.0) {
    // Moderate favorites - positive
    const descriptions = [
      "Decent chance in this field",
      "Could surprise at good odds",
      "Worth a look in this race",
      "Might find the winner's circle", 
      "Has a shot if everything goes right",
      "Could be value at these odds",
      "Capable of an upset here",
      "Don't count out completely",
      "May sneak into the placings",
      "Could run into the money"
    ];
    return descriptions[seed];
  } else if (odds <= 8.0) {
    // Mid-range - neutral to slightly negative
    const descriptions = [
      "Faces a tough task today",
      "Will need everything to go right",
      "Hard to see winning this field",
      "Looks outclassed here",
      "Struggling to find winning form",
      "May battle for minor placings",
      "Needs significant improvement",
      "Unlikely to trouble the leaders",
      "Better races elsewhere",
      "Tough ask in this company"
    ];
    return descriptions[seed];
  } else if (odds <= 15.0) {
    // Longshots - bearish
    const descriptions = [
      "Long shot in this field",
      "Would need a miracle to win",
      "Serious questions about chances",
      "Hard to justify backing today",
      "Looks out of depth here",
      "Struggling against this quality",
      "Needs major form reversal",
      "Unlikely to feature prominently",
      "Better suited to easier races",
      "Tough to see any path to victory"
    ];
    return descriptions[seed];
  } else if (odds <= 30.0) {
    // Long longshots - very bearish
    const descriptions = [
      "No realistic chance today",
      "Completely outclassed in this field",
      "Would be a massive shock to win",
      "Serious doubts about competitiveness",
      "Looks hopelessly outgunned",
      "Can't see any scenario for success",
      "Facing an impossible task",
      "Better off in much easier company",
      "Lacks the ability for this level",
      "Would need everything to go wrong for others"
    ];
    return descriptions[seed];
  } else if (odds <= 50.0) {
    // Extreme longshots - catastrophic
    const descriptions = [
      "Absolutely no chance in this race",
      "Completely out of place here",
      "Would be the upset of the century",
      "Serious questions about even finishing",
      "Looks like a non-runner already",
      "Can't compete at this level",
      "Facing certain defeat today",
      "Shouldn't even be in this field",
      "Would need divine intervention",
      "Destined for last place"
    ];
    return descriptions[seed];
  } else {
    // Impossible longshots - legendary disasters
    const descriptions = [
      "Has zero chance of winning this race",
      "Completely hopeless in this company",
      "Would be the most shocking result ever",
      "Serious concerns about basic competence",
      "Looks like they're running backwards",
      "Can't even compete with these horses",
      "Facing complete humiliation today",
      "Shouldn't be allowed in this race",
      "Would need a racing miracle times ten",
      "Destined for an embarrassing finish"
    ];
    return descriptions[seed];
  }
}

// Keep the old ELO-based function for backwards compatibility
export function getHorseDescription(elo: number): string {
  if (elo >= 2200) {
    const descriptions = [
      "Mythical legend",
      "Godlike champion",
      "Immortal speedster",
      "Divine thoroughbred",
      "Transcendent force",
      "Celestial racer",
      "Ultimate perfection",
      "Supernatural beast",
      "Otherworldly talent",
      "Absolute deity"
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  } else if (elo >= 2000) {
    const descriptions = [
      "Unstoppable champion",
      "Legendary powerhouse",
      "Dominant thoroughbred",
      "Elite racing machine",
      "Speed demon",
      "Supreme athlete",
      "Flawless technique",
      "Racing royalty",
      "Untouchable speedster",
      "Perfect storm"
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  } else if (elo >= 1800) {
    const descriptions = [
      "Powerful contender",
      "Strong competitor",
      "Impressive athlete",
      "Skilled racer",
      "Confident performer",
      "Elite talent",
      "Formidable opponent",
      "Top-tier competitor",
      "Outstanding thoroughbred",
      "Championship caliber"
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  } else if (elo >= 1600) {
    const descriptions = [
      "Solid performer",
      "Reliable competitor",
      "Capable athlete",
      "Consistent runner",
      "Well-trained horse",
      "Respectable contender",
      "Balanced performer",
      "Steady competitor",
      "Decent racer",
      "Competent athlete"
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  } else if (elo >= 1400) {
    const descriptions = [
      "Inconsistent performer",
      "Average competitor",
      "Moderate talent",
      "Unpredictable runner",
      "Mediocre athlete",
      "Fair competitor",
      "Below-average performer",
      "Struggling runner",
      "Unreliable competitor",
      "Disappointing athlete"
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  } else if (elo >= 1200) {
    const descriptions = [
      "Weak competitor",
      "Poor performer",
      "Troubled athlete",
      "Unreliable runner",
      "Subpar competitor",
      "Problematic horse",
      "Declining athlete",
      "Struggling performer",
      "Questionable competitor",
      "Concerning runner"
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  } else if (elo >= 1000) {
    const descriptions = [
      "Failing competitor",
      "Broken performer",
      "Defective athlete",
      "Worthless runner",
      "Pathetic horse",
      "Useless competitor",
      "Terrible performer",
      "Awful athlete",
      "Dreadful runner",
      "Miserable horse"
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  } else if (elo >= 800) {
    const descriptions = [
      "Catastrophic failure",
      "Complete disaster",
      "Total wreck",
      "Absolute nightmare",
      "Hopeless case",
      "Lost cause",
      "Walking disaster",
      "Epic failure",
      "Complete joke",
      "Utter catastrophe"
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  } else {
    const descriptions = [
      "Legendary failure",
      "Mythical disaster",
      "Historic catastrophe",
      "Ultimate nightmare",
      "Supreme disappointment",
      "Perfect disaster",
      "Flawless failure",
      "Elite catastrophe",
      "Championship disaster",
      "Hall of shame"
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }
}

export const HORSE_DATABASE: HorseData[] = [
  // All horses reset to starting ELO of 500
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
  { name: "Wishing Well", elo: 500 },
  { name: "Rainbow Bridge", elo: 500 },
  { name: "Pot of Gold", elo: 500 },
  { name: "Four Leaf", elo: 500 },
  { name: "Horseshoe", elo: 500 },
  { name: "Rabbit Foot", elo: 500 },
  { name: "Penny Found", elo: 500 },
  { name: "Broken Mirror", elo: 500 },
  { name: "Black Cat", elo: 500 },
  { name: "Ladder Walk", elo: 500 },
  { name: "Salt Spill", elo: 500 },
  { name: "Friday 13th", elo: 500 },
  { name: "Umbrella Indoor", elo: 500 },
  { name: "Hat on Bed", elo: 500 },
  { name: "Shoes on Table", elo: 500 },
  { name: "Peacock Feather", elo: 500 },
  
  { name: "Dream Catcher", elo: 500 },
  { name: "Night Mare", elo: 500 },
  { name: "Day Dream", elo: 500 },
  { name: "Sweet Dreams", elo: 500 },
  { name: "Pipe Dream", elo: 500 },
  { name: "American Dream", elo: 500 },
  { name: "Impossible Dream", elo: 500 },
  { name: "Broken Dream", elo: 500 },
  { name: "Lost Dream", elo: 500 },
  { name: "Found Dream", elo: 500 },
  { name: "Big Dreams", elo: 500 },
  { name: "Small Dreams", elo: 500 },
  { name: "Wild Dreams", elo: 500 },
  { name: "Crazy Dreams", elo: 500 },
  { name: "Silly Dreams", elo: 500 },
  
  { name: "Miracle Worker", elo: 500 },
  { name: "Divine Wind", elo: 500 },
  { name: "Heaven Sent", elo: 500 },
  { name: "Angel Wings", elo: 500 },
  { name: "Holy Spirit", elo: 500 },
  { name: "Sacred Heart", elo: 500 },
  { name: "Blessed Soul", elo: 500 },
  { name: "Pure Light", elo: 500 },
  { name: "Eternal Flame", elo: 500 },
  { name: "Infinite Love", elo: 500 },
  
  // Classic Names
  { name: "Secretariat Jr", elo: 500 },
  { name: "Man O War", elo: 500 },
  { name: "Seabiscuit", elo: 500 },
  { name: "War Admiral", elo: 500 },
  { name: "Citation", elo: 500 },
  { name: "Whirlaway", elo: 500 },
  { name: "Count Fleet", elo: 500 },
  { name: "Assault", elo: 500 },
  { name: "Triple Crown", elo: 500 },
  { name: "Kentucky Derby", elo: 500 },
  
  // Speed Names
  { name: "Velocity", elo: 500 },
  { name: "Acceleration", elo: 500 },
  { name: "Momentum", elo: 500 },
  { name: "Kinetic", elo: 500 },
  { name: "Turbo Charge", elo: 500 },
  { name: "Nitro Boost", elo: 500 },
  { name: "Rocket Fuel", elo: 500 },
  { name: "Jet Stream", elo: 500 },
  { name: "Sonic Boom", elo: 500 },
  { name: "Light Speed", elo: 500 },
  
  // Color Names
  { name: "Crimson Red", elo: 500 },
  { name: "Ocean Blue", elo: 500 },
  { name: "Forest Green", elo: 500 },
  { name: "Sunset Orange", elo: 500 },
  { name: "Royal Purple", elo: 500 },
  { name: "Golden Yellow", elo: 500 },
  { name: "Silver Gray", elo: 500 },
  { name: "Jet Black", elo: 500 },
  { name: "Pure White", elo: 500 },
  { name: "Rose Pink", elo: 500 },
  
  // Weather Names
  { name: "Hurricane", elo: 500 },
  { name: "Tornado", elo: 500 },
  { name: "Blizzard", elo: 500 },
  { name: "Thunderstorm", elo: 500 },
  { name: "Lightning Strike", elo: 500 },
  { name: "Hailstorm", elo: 500 },
  { name: "Sandstorm", elo: 500 },
  { name: "Cyclone", elo: 500 },
  { name: "Typhoon", elo: 500 },
  { name: "Monsoon", elo: 500 },
  
  // Mythical Names
  { name: "Pegasus", elo: 500 },
  { name: "Unicorn", elo: 500 },
  { name: "Centaur", elo: 500 },
  { name: "Griffin", elo: 500 },
  { name: "Phoenix Fire", elo: 500 },
  { name: "Dragon Fly", elo: 500 },
  { name: "Minotaur", elo: 500 },
  { name: "Chimera", elo: 500 },
  { name: "Hydra", elo: 500 },
  { name: "Kraken", elo: 500 },
  
  // Gem Names
  { name: "Diamond Dust", elo: 500 },
  { name: "Ruby Red", elo: 500 },
  { name: "Emerald Green", elo: 500 },
  { name: "Sapphire Blue", elo: 500 },
  { name: "Topaz Gold", elo: 500 },
  { name: "Amethyst Purple", elo: 500 },
  { name: "Opal White", elo: 500 },
  { name: "Garnet Dark", elo: 500 },
  { name: "Turquoise Bright", elo: 500 },
  { name: "Pearl Shine", elo: 500 },
  
  // Space Names
  { name: "Comet Tail", elo: 500 },
  { name: "Meteor Shower", elo: 500 },
  { name: "Galaxy Far", elo: 500 },
  { name: "Nebula Cloud", elo: 500 },
  { name: "Supernova", elo: 500 },
  { name: "Black Hole", elo: 500 },
  { name: "Wormhole", elo: 500 },
  { name: "Time Warp", elo: 500 },
  { name: "Space Odyssey", elo: 500 },
  { name: "Alien Visitor", elo: 500 },
  
  // Music Names
  { name: "Symphony", elo: 500 },
  { name: "Harmony", elo: 500 },
  { name: "Melody", elo: 500 },
  { name: "Rhythm", elo: 500 },
  { name: "Beat Drop", elo: 500 },
  { name: "Bass Line", elo: 500 },
  { name: "High Note", elo: 500 },
  { name: "Low Key", elo: 500 },
  { name: "Sharp Edge", elo: 500 },
  { name: "Flat Line", elo: 500 },
  
  // Food Names (Fun ones)
  { name: "Sugar Rush", elo: 500 },
  { name: "Spice Rack", elo: 500 },
  { name: "Sweet Tooth", elo: 500 },
  { name: "Hot Sauce", elo: 500 },
  { name: "Cool Mint", elo: 500 },
  { name: "Sour Patch", elo: 500 },
  { name: "Bitter End", elo: 500 },
  { name: "Salty Dog", elo: 500 },
  { name: "Umami Bomb", elo: 500 },
  { name: "Flavor Town", elo: 500 },
  
  // Tech Names
  { name: "Quantum Leap", elo: 500 },
  { name: "Binary Code", elo: 500 },
  { name: "Algorithm", elo: 500 },
  { name: "Data Stream", elo: 500 },
  { name: "Cloud Nine", elo: 500 },
  { name: "Firewall", elo: 500 },
  { name: "Virus Scan", elo: 500 },
  { name: "Debug Mode", elo: 500 },
  { name: "System Error", elo: 500 },
  { name: "Blue Screen", elo: 500 },
  
  // Random Fun Names
  { name: "Banana Split", elo: 500 },
  { name: "Pickle Jar", elo: 500 },
  { name: "Rubber Duck", elo: 500 },
  { name: "Paper Clip", elo: 500 },
  { name: "Stapler", elo: 500 },
  { name: "Coffee Mug", elo: 500 },
  { name: "Pencil Sharpener", elo: 500 },
  { name: "Eraser Head", elo: 500 },
  { name: "Glue Stick", elo: 500 },
  { name: "Tape Dispenser", elo: 500 },
  
  // Final Batch
  { name: "Last Call", elo: 500 },
  { name: "Final Hour", elo: 500 },
  { name: "End Game", elo: 500 },
  { name: "Game Over", elo: 500 },
  { name: "The End", elo: 500 },
  { name: "Fade Out", elo: 500 },
  { name: "Roll Credits", elo: 500 },
  { name: "That's All Folks", elo: 500 },
  { name: "See You Later", elo: 500 },
  { name: "Until Next Time", elo: 500 },

  // NEW HORSES - All reset to 500 ELO
  
  // Elite Champions - All reset to 500
  { name: "Apex Predator", elo: 500 },
  { name: "Unstoppable Force", elo: 500 },
  { name: "Perfect Storm", elo: 500 },
  { name: "Absolute Zero", elo: 500 },
  { name: "Maximum Velocity", elo: 500 },
  { name: "Ultimate Warrior", elo: 500 },
  { name: "Supreme Leader", elo: 500 },
  { name: "Elite Champion", elo: 500 },
  { name: "Master Class", elo: 500 },
  { name: "Legendary Beast", elo: 500 },
  { name: "Titan's Fury", elo: 500 },
  { name: "God of Speed", elo: 500 },
  { name: "Immortal Spirit", elo: 500 },
  { name: "Eternal Glory", elo: 500 },
  { name: "Divine Thunder", elo: 500 },
  { name: "Celestial Fire", elo: 500 },
  { name: "Cosmic Force", elo: 500 },
  { name: "Infinite Power", elo: 500 },
  { name: "Boundless Energy", elo: 500 },
  { name: "Limitless Potential", elo: 500 },

  // Strong Contenders - All reset to 500
  { name: "Steel Magnolia", elo: 500 },
  { name: "Iron Will", elo: 500 },
  { name: "Copper Canyon", elo: 500 },
  { name: "Bronze Warrior", elo: 500 },
  { name: "Platinum Star", elo: 500 },
  { name: "Golden Eagle", elo: 500 },
  { name: "Silver Streak", elo: 500 },
  { name: "Crystal Clear", elo: 500 },
  { name: "Diamond Edge", elo: 500 },
  { name: "Ruby Flame", elo: 500 },
  { name: "Emerald Dream", elo: 500 },
  { name: "Sapphire Storm", elo: 500 },
  { name: "Topaz Thunder", elo: 500 },
  { name: "Amethyst Arrow", elo: 500 },
  { name: "Opal Ocean", elo: 500 },
  { name: "Garnet Glory", elo: 500 },
  { name: "Turquoise Tide", elo: 500 },
  { name: "Pearl Power", elo: 500 },
  { name: "Jade Justice", elo: 500 },
  { name: "Onyx Odyssey", elo: 500 },
  { name: "Marble Majesty", elo: 500 },
  { name: "Granite Guardian", elo: 500 },
  { name: "Quartz Quest", elo: 500 },
  { name: "Flint Fire", elo: 500 },
  { name: "Slate Storm", elo: 500 },
  { name: "Shale Shadow", elo: 500 },
  { name: "Limestone Lightning", elo: 500 },
  { name: "Sandstone Spirit", elo: 500 },
  { name: "Basalt Blaze", elo: 500 },
  { name: "Obsidian Oracle", elo: 500 },

  // Competitive Horses - All reset to 500
  { name: "Arctic Fox", elo: 500 },
  { name: "Desert Rose", elo: 500 },
  { name: "Mountain Lion", elo: 500 },
  { name: "Prairie Wolf", elo: 500 },
  { name: "Forest Ranger", elo: 500 },
  { name: "Ocean Warrior", elo: 500 },
  { name: "River Guardian", elo: 500 },
  { name: "Lake Legend", elo: 500 },
  { name: "Valley Victor", elo: 500 },
  { name: "Hill Hero", elo: 500 },
  { name: "Canyon Crusader", elo: 500 },
  { name: "Mesa Master", elo: 500 },
  { name: "Plateau Pioneer", elo: 500 },
  { name: "Ridge Runner", elo: 500 },
  { name: "Peak Performer", elo: 500 },
  { name: "Summit Seeker", elo: 500 },
  { name: "Cliff Climber", elo: 500 },
  { name: "Rock Racer", elo: 500 },
  { name: "Stone Stallion", elo: 500 },
  { name: "Boulder Beast", elo: 500 },
  { name: "Pebble Prince", elo: 500 },
  { name: "Sand Surfer", elo: 500 },
  { name: "Dust Devil", elo: 500 },
  { name: "Wind Whisperer", elo: 500 },
  { name: "Breeze Bringer", elo: 500 },
  { name: "Gale Guardian", elo: 500 },
  { name: "Storm Striker", elo: 500 },
  { name: "Thunder Thief", elo: 500 },
  { name: "Lightning Lancer", elo: 500 },
  { name: "Rain Rider", elo: 500 },
  { name: "Snow Sprinter", elo: 500 },
  { name: "Ice Interceptor", elo: 500 },
  { name: "Frost Fighter", elo: 500 },
  { name: "Hail Hunter", elo: 500 },
  { name: "Sleet Slayer", elo: 500 },
  { name: "Mist Maker", elo: 500 },
  { name: "Fog Fighter", elo: 500 },
  { name: "Cloud Chaser", elo: 500 },
  { name: "Sky Sailor", elo: 500 },
  { name: "Star Striker", elo: 500 },

  // Underdogs - All reset to 500
  { name: "Midnight Oil", elo: 500 },
  { name: "Dawn Patrol", elo: 500 },
  { name: "Sunrise Special", elo: 500 },
  { name: "Sunset Serenade", elo: 500 },
  { name: "Twilight Zone", elo: 500 },
  { name: "Dusk Dancer", elo: 500 },
  { name: "Evening Star", elo: 500 },
  { name: "Night Owl", elo: 500 },
  { name: "Morning Glory", elo: 500 },
  { name: "Afternoon Delight", elo: 500 },
  { name: "Noon Day Sun", elo: 500 },
  { name: "High Noon", elo: 500 },
  { name: "Witching Hour", elo: 500 },
  { name: "Golden Hour", elo: 500 },
  { name: "Blue Hour", elo: 500 },
  { name: "Magic Hour", elo: 500 },
  { name: "Rush Hour", elo: 500 },
  { name: "Happy Hour", elo: 500 },
  { name: "Power Hour", elo: 500 },
  { name: "Final Hour", elo: 500 },
  { name: "Spring Forward", elo: 500 },
  { name: "Summer Breeze", elo: 500 },
  { name: "Autumn Leaves", elo: 500 },
  { name: "Winter Frost", elo: 500 },
  { name: "April Showers", elo: 500 },
  { name: "May Flowers", elo: 500 },
  { name: "June Bug", elo: 500 },
  { name: "July Heat", elo: 500 },
  { name: "August Storm", elo: 500 },
  { name: "September Song", elo: 500 },
  { name: "October Sky", elo: 500 },
  { name: "November Rain", elo: 500 },
  { name: "December Snow", elo: 500 },
  { name: "January Thaw", elo: 500 },
  { name: "February Freeze", elo: 500 },
  { name: "March Madness", elo: 500 },
  { name: "Leap Year", elo: 500 },
  { name: "New Year", elo: 500 },
  { name: "Old Timer", elo: 500 },
  { name: "Time Keeper", elo: 500 },

  // Long Shots - All reset to 500
  { name: "Lucky Strike", elo: 500 },
  { name: "Fortune Teller", elo: 500 },
  { name: "Chance Encounter", elo: 500 },
  { name: "Random Walk", elo: 500 },
  { name: "Wild Card", elo: 500 },
  { name: "Dark Horse", elo: 500 },
  { name: "Long Shot", elo: 500 },
  { name: "Underdog", elo: 500 },
  { name: "Sleeper Hit", elo: 500 },
  { name: "Hidden Gem", elo: 500 },
  { name: "Secret Weapon", elo: 500 },
  { name: "Surprise Package", elo: 500 },
  { name: "Unexpected Guest", elo: 500 },
  { name: "Plot Twist", elo: 500 },
  { name: "Game Changer", elo: 500 },
  { name: "Rule Breaker", elo: 500 },
  { name: "Trend Setter", elo: 500 },
  { name: "Pace Maker", elo: 500 },
  { name: "Trail Blazer", elo: 500 },
  { name: "Path Finder", elo: 500 },
  { name: "Road Runner", elo: 500 },
  { name: "Street Smart", elo: 500 },
  { name: "City Slicker", elo: 500 },
  { name: "Country Boy", elo: 500 },
  { name: "Small Town", elo: 500 },
  { name: "Big City", elo: 500 },
  { name: "Main Street", elo: 500 },
  { name: "Back Road", elo: 500 },
  { name: "Side Street", elo: 500 },
  { name: "Dead End", elo: 500 },
  { name: "One Way", elo: 500 },
  { name: "Two Way", elo: 500 },
  { name: "Three Way", elo: 500 },
  { name: "Four Way", elo: 500 },
  { name: "Five Star", elo: 500 },
  { name: "Six Pack", elo: 500 },
  { name: "Seven Eleven", elo: 500 },
  { name: "Eight Ball", elo: 500 },
  { name: "Nine Lives", elo: 500 },
  { name: "Perfect Ten", elo: 500 },

  // Extreme Long Shots - All reset to 500
  { name: "Hail Mary", elo: 500 },
  { name: "Wing and Prayer", elo: 500 },
  { name: "Hope Springs", elo: 500 },
  { name: "Faith Keeper", elo: 500 },
  { name: "Believe It", elo: 500 },
  { name: "Never Say Die", elo: 500 },
  { name: "Against All Odds", elo: 500 },
  { name: "Miracle Mile", elo: 500 },
  { name: "Divine Intervention", elo: 500 },
  { name: "Acts of God", elo: 500 },
  { name: "Higher Power", elo: 500 },
  { name: "Guardian Angel", elo: 500 },
  { name: "Saving Grace", elo: 500 },
  { name: "Amazing Grace", elo: 500 },
  { name: "Leap of Faith", elo: 500 },
  { name: "Blind Faith", elo: 500 },
  { name: "True Believer", elo: 500 },
  { name: "Faithful Friend", elo: 500 },
  { name: "Loyal Companion", elo: 500 },
  { name: "Steady Eddie", elo: 500 },
  { name: "Slow and Steady", elo: 500 },
  { name: "Tortoise Tale", elo: 500 },
  { name: "Patient Zero", elo: 500 },
  { name: "Waiting Game", elo: 500 },
  { name: "Good Things Come", elo: 500 },
  { name: "Better Late", elo: 500 },
  { name: "Never Too Late", elo: 500 },
  { name: "Second Chance", elo: 500 },
  { name: "Third Time", elo: 500 },
  { name: "Fourth Quarter", elo: 500 },
  { name: "Fifth Element", elo: 500 },
  { name: "Sixth Sense", elo: 500 },
  { name: "Seventh Heaven", elo: 500 },
  { name: "Eighth Wonder", elo: 500 },
  { name: "Ninth Inning", elo: 500 },
  { name: "Tenth Hour", elo: 500 },
  { name: "Eleventh Hour", elo: 500 },
  { name: "Twelfth Night", elo: 500 },
  { name: "Baker's Dozen", elo: 500 },
  { name: "Lucky Thirteen", elo: 500 },

  // Additional Fun Categories - All reset to 500
  { name: "Pizza Slice", elo: 500 },
  { name: "Burger King", elo: 500 },
  { name: "Taco Tuesday", elo: 500 },
  { name: "Sushi Roll", elo: 500 },
  { name: "Pasta La Vista", elo: 500 },
  { name: "Donut Worry", elo: 500 },
  { name: "Ice Cream Dream", elo: 500 },
  { name: "Cookie Monster", elo: 500 },
  { name: "Cake Walk", elo: 500 },
  { name: "Pie in Sky", elo: 500 },
  { name: "Bread Winner", elo: 500 },
  { name: "Butter Cup", elo: 500 },
  { name: "Honey Bee", elo: 500 },
  { name: "Sugar High", elo: 500 },
  { name: "Salt of Earth", elo: 500 },
  { name: "Pepper Pot", elo: 500 },
  { name: "Spice of Life", elo: 500 },
  { name: "Herb Garden", elo: 500 },
  { name: "Mint Condition", elo: 500 },
  { name: "Vanilla Sky", elo: 500 },
  { name: "Chocolate Rain", elo: 500 },
  { name: "Strawberry Fields", elo: 500 },
  { name: "Blueberry Hill", elo: 500 },
  { name: "Raspberry Beret", elo: 500 },
  { name: "Blackberry Smoke", elo: 500 },
  { name: "Cherry Bomb", elo: 500 },
  { name: "Apple Pie", elo: 500 },
  { name: "Orange Crush", elo: 500 },
  { name: "Lemon Drop", elo: 500 },
  { name: "Lime Light", elo: 500 },
  { name: "Grape Expectations", elo: 500 },
  { name: "Banana Republic", elo: 500 },
  { name: "Pineapple Express", elo: 500 },
  { name: "Coconut Grove", elo: 500 },
  { name: "Mango Tango", elo: 500 },
  { name: "Peach Fuzz", elo: 500 },
  { name: "Plum Crazy", elo: 500 },
  { name: "Apricot Sunset", elo: 500 },
  { name: "Kiwi Bird", elo: 500 },
  { name: "Papaya Paradise", elo: 500 },

  // LEGENDARY TIER - All reset to 500
  { name: "Secretariat Reborn", elo: 500 },
  { name: "Eclipse Eternal", elo: 500 },
  { name: "Phar Lap's Ghost", elo: 500 },
  { name: "Man O War II", elo: 500 },
  { name: "Citation Supreme", elo: 500 },
  { name: "Seattle Slew's Heir", elo: 500 },
  { name: "Affirmed Forever", elo: 500 },
  { name: "War Admiral's Spirit", elo: 500 },
  { name: "Count Fleet's Legacy", elo: 500 },
  { name: "Whirlaway's Dream", elo: 500 },
  { name: "Assault's Revenge", elo: 500 },

  // More Legendary Horses - All reset to 500
  { name: "Thunder God", elo: 500 },
  { name: "Lightning Emperor", elo: 500 },
  { name: "Storm King", elo: 500 },
  { name: "Fire Lord", elo: 500 },
  { name: "Ice Queen", elo: 500 },
  { name: "Wind Master", elo: 500 },
  { name: "Earth Shaker", elo: 500 },
  { name: "Sky Ruler", elo: 500 },
  { name: "Ocean Sovereign", elo: 500 },
  { name: "Mountain Monarch", elo: 500 },

  // Historical Racing Legends - All reset to 500
  { name: "Black Caviar's Shadow", elo: 500 },
  { name: "Frankel's Fury", elo: 500 },
  { name: "Zenyatta's Grace", elo: 500 },
  { name: "American Pharoah's Pride", elo: 500 },
  { name: "Justify's Justice", elo: 500 },
  { name: "California Chrome's Shine", elo: 500 },
  { name: "Arrogate's Arrow", elo: 500 },
  { name: "Gun Runner's Bullet", elo: 500 },
  { name: "Winx's Wings", elo: 500 },
  { name: "Enable's Power", elo: 500 },

  // Mythical Creatures - All reset to 500
  { name: "Sleipnir's Thunder", elo: 500 }, // Odin's 8-legged horse
  { name: "Pegasus Prime", elo: 500 },
  { name: "Unicorn's Horn", elo: 500 },
  { name: "Phoenix Reborn", elo: 500 },
  { name: "Dragon's Breath", elo: 500 },
  { name: "Centaur's Wisdom", elo: 500 },
  { name: "Griffin's Flight", elo: 500 },
  { name: "Hippogriff's Soar", elo: 500 },
  { name: "Kelpie's Wave", elo: 500 },
  { name: "Nightmare's Shadow", elo: 500 }
];

export function getRandomHorses(count: number = 8): HorseData[] {
  // Create weighted selection based on ELO tiers
  // Lower ELO horses have higher spawn weights (more common)
  // Higher ELO horses have lower spawn weights (more rare)
  
  const weightedHorses = HORSE_DATABASE.map(horse => {
    let weight: number;
    
    if (horse.elo >= 2200) {
      weight = 1; // Mythical: Extremely rare (1x weight)
    } else if (horse.elo >= 2000) {
      weight = 2; // Legendary: Very rare (2x weight)
    } else if (horse.elo >= 1900) {
      weight = 3; // Legendary: Rare (3x weight)
    } else if (horse.elo >= 1800) {
      weight = 5; // Champion: Uncommon (5x weight)
    } else if (horse.elo >= 1700) {
      weight = 8; // Elite: Less common (8x weight)
    } else if (horse.elo >= 1600) {
      weight = 12; // Expert: Moderate (12x weight)
    } else if (horse.elo >= 1400) {
      weight = 20; // Competitive: Common (20x weight)
    } else if (horse.elo >= 1200) {
      weight = 30; // Underdog: Very common (30x weight)
    } else if (horse.elo >= 1000) {
      weight = 25; // Long shot: Common (25x weight)
    } else {
      weight = 15; // Extreme long shot: Less common (15x weight)
    }
    
    return { horse, weight };
  });
  
  // Create weighted selection pool
  const selectionPool: HorseData[] = [];
  weightedHorses.forEach(({ horse, weight }) => {
    for (let i = 0; i < weight; i++) {
      selectionPool.push(horse);
    }
  });
  
  // Randomly select horses from the weighted pool
  const selectedHorses: HorseData[] = [];
  const usedHorses = new Set<string>();
  
  while (selectedHorses.length < count && selectedHorses.length < HORSE_DATABASE.length) {
    const randomIndex = Math.floor(Math.random() * selectionPool.length);
    const selectedHorse = selectionPool[randomIndex];
    
    // Ensure no duplicates
    if (!usedHorses.has(selectedHorse.name)) {
      selectedHorses.push(selectedHorse);
      usedHorses.add(selectedHorse.name);
    }
  }
  
  return selectedHorses;
}

// Generate random horses with full Horse interface
export function generateRandomHorses(count: number = 8): any[] {
  const randomHorses = getRandomHorses(count);
  
  // Use dynamic ELO ratings instead of static database values
  const horsesWithDynamicElo = randomHorses.map(horse => ({
    ...horse,
    elo: getHorseElo(horse.name) // Get current ELO from localStorage
  }));
  
  const oddsData = calculateOddsFromELO(horsesWithDynamicElo);
  
  return horsesWithDynamicElo.map((horse, index) => {
    const odds = oddsData.find(o => o.name === horse.name)?.odds || 5.0;
    
    // Generate attributes based on current ELO (not database ELO)
    const baseSpeed = Math.max(60, Math.min(95, 60 + (horse.elo - 500) / 20));
    const baseStamina = Math.max(60, Math.min(95, 60 + (horse.elo - 500) / 25));
    const baseAcceleration = Math.max(60, Math.min(95, 60 + (horse.elo - 500) / 22));
    
    // Add some randomness
    const speed = Math.round(baseSpeed + (Math.random() - 0.5) * 10);
    const stamina = Math.round(baseStamina + (Math.random() - 0.5) * 10);
    const acceleration = Math.round(baseAcceleration + (Math.random() - 0.5) * 10);
    
    return {
      id: `horse-${index + 1}`,
      name: horse.name,
      lane: index + 1,
      elo: horse.elo, // Use dynamic ELO
      odds: odds,
      speed: Math.max(60, Math.min(95, speed)),
      stamina: Math.max(60, Math.min(95, stamina)),
      acceleration: Math.max(60, Math.min(95, acceleration)),
      color: getHorseColor(horse.name),
      sprintStartPercent: 40 + Math.random() * 35
    };
  });
}

// Calculate balanced odds based on ELO ratings of all horses in the race
export function calculateOddsFromELO(horses: HorseData[]): { name: string; odds: number }[] {
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

// Helper function to get ordinal suffix
function getOrdinalSuffix(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const remainder = n % 100;
  if (remainder >= 11 && remainder <= 13) {
    return suffixes[0];
  }
  return suffixes[n % 10];
}