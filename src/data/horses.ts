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
  console.log('🔄 All ELO ratings reset to 500');
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
  // Elite Champions (High ELO 1800-2000)
  { name: "Thunder Strike", elo: 1950 },
  { name: "Lightning Bolt", elo: 1920 },
  { name: "Storm Chaser", elo: 1940 },
  { name: "Fire Storm", elo: 1900 },
  { name: "Golden Arrow", elo: 1960 },
  { name: "Silver Bullet", elo: 1910 },
  { name: "Midnight Express", elo: 1930 },
  { name: "Royal Thunder", elo: 1890 },
  { name: "Diamond Dash", elo: 1970 },
  { name: "Crimson Flash", elo: 1880 },
  
  // Strong Contenders (Medium-high ELO 1600-1799)
  { name: "Blazing Glory", elo: 1750 },
  { name: "Wind Walker", elo: 1720 },
  { name: "Star Gazer", elo: 1760 },
  { name: "Moon Runner", elo: 1700 },
  { name: "Sun Dancer", elo: 1740 },
  { name: "Ocean Breeze", elo: 1710 },
  { name: "Mountain Peak", elo: 1730 },
  { name: "Desert Wind", elo: 1690 },
  { name: "Forest Fire", elo: 1680 },
  { name: "River Rush", elo: 1770 },
  { name: "Eagle Eye", elo: 1660 },
  { name: "Falcon Flight", elo: 1650 },
  { name: "Phoenix Rising", elo: 1780 },
  { name: "Dragon Heart", elo: 1670 },
  { name: "Tiger Stripe", elo: 1640 },
  
  // Competitive Horses (Medium ELO 1400-1599)
  { name: "Brave Spirit", elo: 1550 },
  { name: "Wild Mustang", elo: 1520 },
  { name: "Free Runner", elo: 1560 },
  { name: "Swift Arrow", elo: 1490 },
  { name: "Noble Knight", elo: 1540 },
  { name: "Gentle Giant", elo: 1510 },
  { name: "Proud Warrior", elo: 1530 },
  { name: "Silent Storm", elo: 1500 },
  { name: "Dancing Queen", elo: 1480 },
  { name: "Singing Bird", elo: 1570 },
  { name: "Flying Fish", elo: 1460 },
  { name: "Jumping Jack", elo: 1450 },
  { name: "Running Bear", elo: 1470 },
  { name: "Climbing Cat", elo: 1440 },
  { name: "Swimming Swan", elo: 1430 },
  { name: "Soaring Hawk", elo: 1420 },
  { name: "Roaring Lion", elo: 1410 },
  { name: "Howling Wolf", elo: 1400 },
  { name: "Barking Dog", elo: 1390 },
  { name: "Meowing Mouse", elo: 1580 },
  
  // Underdogs (Medium-low ELO 1200-1399)
  { name: "Lucky Charm", elo: 1350 },
  { name: "Magic Wand", elo: 1320 },
  { name: "Crystal Ball", elo: 1360 },
  { name: "Shooting Star", elo: 1290 },
  { name: "Wishing Well", elo: 1340 },
  { name: "Rainbow Bridge", elo: 1310 },
  { name: "Pot of Gold", elo: 1370 },
  { name: "Four Leaf", elo: 1280 },
  { name: "Horseshoe", elo: 1330 },
  { name: "Rabbit Foot", elo: 1300 },
  { name: "Penny Found", elo: 1380 },
  { name: "Broken Mirror", elo: 1270 },
  { name: "Black Cat", elo: 1260 },
  { name: "Ladder Walk", elo: 1250 },
  { name: "Salt Spill", elo: 1240 },
  { name: "Friday 13th", elo: 1230 },
  { name: "Umbrella Indoor", elo: 1220 },
  { name: "Hat on Bed", elo: 1210 },
  { name: "Shoes on Table", elo: 1200 },
  { name: "Peacock Feather", elo: 1390 },
  
  // Long Shots (Low ELO 1000-1199)
  { name: "Dream Catcher", elo: 1150 },
  { name: "Night Mare", elo: 1120 },
  { name: "Day Dream", elo: 1140 },
  { name: "Sweet Dreams", elo: 1110 },
  { name: "Pipe Dream", elo: 1160 },
  { name: "American Dream", elo: 1100 },
  { name: "Impossible Dream", elo: 1090 },
  { name: "Broken Dream", elo: 1080 },
  { name: "Lost Dream", elo: 1070 },
  { name: "Found Dream", elo: 1130 },
  { name: "Big Dreams", elo: 1060 },
  { name: "Small Dreams", elo: 1050 },
  { name: "Wild Dreams", elo: 1040 },
  { name: "Crazy Dreams", elo: 1030 },
  { name: "Silly Dreams", elo: 1020 },
  
  // Extreme Long Shots (Very low ELO 800-999)
  { name: "Miracle Worker", elo: 950 },
  { name: "Divine Wind", elo: 920 },
  { name: "Heaven Sent", elo: 940 },
  { name: "Angel Wings", elo: 910 },
  { name: "Holy Spirit", elo: 960 },
  { name: "Sacred Heart", elo: 900 },
  { name: "Blessed Soul", elo: 890 },
  { name: "Pure Light", elo: 880 },
  { name: "Eternal Flame", elo: 870 },
  { name: "Infinite Love", elo: 860 },
  
  // Classic Names
  { name: "Secretariat Jr", elo: 1720 },
  { name: "Man O War", elo: 1800 },
  { name: "Seabiscuit", elo: 1680 },
  { name: "War Admiral", elo: 1700 },
  { name: "Citation", elo: 1660 },
  { name: "Whirlaway", elo: 1580 },
  { name: "Count Fleet", elo: 1560 },
  { name: "Assault", elo: 1540 },
  { name: "Triple Crown", elo: 1850 },
  { name: "Kentucky Derby", elo: 1750 },
  
  // Speed Names
  { name: "Velocity", elo: 1620 },
  { name: "Acceleration", elo: 1590 },
  { name: "Momentum", elo: 1570 },
  { name: "Kinetic", elo: 1550 },
  { name: "Turbo Charge", elo: 1630 },
  { name: "Nitro Boost", elo: 1610 },
  { name: "Rocket Fuel", elo: 1600 },
  { name: "Jet Stream", elo: 1580 },
  { name: "Sonic Boom", elo: 1560 },
  { name: "Light Speed", elo: 1540 },
  
  // Color Names
  { name: "Crimson Red", elo: 1520 },
  { name: "Ocean Blue", elo: 1500 },
  { name: "Forest Green", elo: 1480 },
  { name: "Sunset Orange", elo: 1460 },
  { name: "Royal Purple", elo: 1440 },
  { name: "Golden Yellow", elo: 1420 },
  { name: "Silver Gray", elo: 1400 },
  { name: "Jet Black", elo: 1380 },
  { name: "Pure White", elo: 1360 },
  { name: "Rose Pink", elo: 1340 },
  
  // Weather Names
  { name: "Hurricane", elo: 1350 },
  { name: "Tornado", elo: 1330 },
  { name: "Blizzard", elo: 1310 },
  { name: "Thunderstorm", elo: 1290 },
  { name: "Lightning Strike", elo: 1270 },
  { name: "Hailstorm", elo: 1250 },
  { name: "Sandstorm", elo: 1230 },
  { name: "Cyclone", elo: 1210 },
  { name: "Typhoon", elo: 1190 },
  { name: "Monsoon", elo: 1170 },
  
  // Mythical Names
  { name: "Pegasus", elo: 1540 },
  { name: "Unicorn", elo: 1520 },
  { name: "Centaur", elo: 1500 },
  { name: "Griffin", elo: 1480 },
  { name: "Phoenix Fire", elo: 1460 },
  { name: "Dragon Fly", elo: 1440 },
  { name: "Minotaur", elo: 1420 },
  { name: "Chimera", elo: 1400 },
  { name: "Hydra", elo: 1380 },
  { name: "Kraken", elo: 1360 },
  
  // Gem Names
  { name: "Diamond Dust", elo: 1320 },
  { name: "Ruby Red", elo: 1300 },
  { name: "Emerald Green", elo: 1280 },
  { name: "Sapphire Blue", elo: 1260 },
  { name: "Topaz Gold", elo: 1240 },
  { name: "Amethyst Purple", elo: 1220 },
  { name: "Opal White", elo: 1200 },
  { name: "Garnet Dark", elo: 1180 },
  { name: "Turquoise Bright", elo: 1160 },
  { name: "Pearl Shine", elo: 1140 },
  
  // Space Names
  { name: "Comet Tail", elo: 1120 },
  { name: "Meteor Shower", elo: 1100 },
  { name: "Galaxy Far", elo: 1080 },
  { name: "Nebula Cloud", elo: 1060 },
  { name: "Supernova", elo: 1040 },
  { name: "Black Hole", elo: 1020 },
  { name: "Wormhole", elo: 1000 },
  { name: "Time Warp", elo: 980 },
  { name: "Space Odyssey", elo: 960 },
  { name: "Alien Visitor", elo: 940 },
  
  // Music Names
  { name: "Symphony", elo: 1300 },
  { name: "Harmony", elo: 1280 },
  { name: "Melody", elo: 1260 },
  { name: "Rhythm", elo: 1240 },
  { name: "Beat Drop", elo: 1220 },
  { name: "Bass Line", elo: 1200 },
  { name: "High Note", elo: 1180 },
  { name: "Low Key", elo: 1160 },
  { name: "Sharp Edge", elo: 1140 },
  { name: "Flat Line", elo: 1120 },
  
  // Food Names (Fun ones)
  { name: "Sugar Rush", elo: 1100 },
  { name: "Spice Rack", elo: 1080 },
  { name: "Sweet Tooth", elo: 1060 },
  { name: "Hot Sauce", elo: 1040 },
  { name: "Cool Mint", elo: 1020 },
  { name: "Sour Patch", elo: 1000 },
  { name: "Bitter End", elo: 980 },
  { name: "Salty Dog", elo: 960 },
  { name: "Umami Bomb", elo: 940 },
  { name: "Flavor Town", elo: 920 },
  
  // Tech Names
  { name: "Quantum Leap", elo: 900 },
  { name: "Binary Code", elo: 880 },
  { name: "Algorithm", elo: 860 },
  { name: "Data Stream", elo: 840 },
  { name: "Cloud Nine", elo: 820 },
  { name: "Firewall", elo: 800 },
  { name: "Virus Scan", elo: 780 },
  { name: "Debug Mode", elo: 760 },
  { name: "System Error", elo: 740 },
  { name: "Blue Screen", elo: 720 },
  
  // Random Fun Names
  { name: "Banana Split", elo: 700 },
  { name: "Pickle Jar", elo: 680 },
  { name: "Rubber Duck", elo: 660 },
  { name: "Paper Clip", elo: 640 },
  { name: "Stapler", elo: 620 },
  { name: "Coffee Mug", elo: 600 },
  { name: "Pencil Sharpener", elo: 580 },
  { name: "Eraser Head", elo: 560 },
  { name: "Glue Stick", elo: 540 },
  { name: "Tape Dispenser", elo: 520 },
  
  // Final Batch
  { name: "Last Call", elo: 500 },
  { name: "Final Hour", elo: 480 },
  { name: "End Game", elo: 460 },
  { name: "Game Over", elo: 440 },
  { name: "The End", elo: 420 },
  { name: "Fade Out", elo: 400 },
  { name: "Roll Credits", elo: 380 },
  { name: "That's All Folks", elo: 360 },
  { name: "See You Later", elo: 340 },
  { name: "Until Next Time", elo: 320 },

  // NEW HORSES - 200 Additional Entries
  
  // Elite Champions (1800-2000) - 20 more
  { name: "Apex Predator", elo: 1985 },
  { name: "Unstoppable Force", elo: 1975 },
  { name: "Perfect Storm", elo: 1965 },
  { name: "Absolute Zero", elo: 1955 },
  { name: "Maximum Velocity", elo: 1945 },
  { name: "Ultimate Warrior", elo: 1935 },
  { name: "Supreme Leader", elo: 1925 },
  { name: "Elite Champion", elo: 1915 },
  { name: "Master Class", elo: 1905 },
  { name: "Legendary Beast", elo: 1895 },
  { name: "Titan's Fury", elo: 1885 },
  { name: "God of Speed", elo: 1875 },
  { name: "Immortal Spirit", elo: 1865 },
  { name: "Eternal Glory", elo: 1855 },
  { name: "Divine Thunder", elo: 1845 },
  { name: "Celestial Fire", elo: 1835 },
  { name: "Cosmic Force", elo: 1825 },
  { name: "Infinite Power", elo: 1815 },
  { name: "Boundless Energy", elo: 1805 },
  { name: "Limitless Potential", elo: 1800 },

  // Strong Contenders (1600-1799) - 30 more
  { name: "Steel Magnolia", elo: 1790 },
  { name: "Iron Will", elo: 1785 },
  { name: "Copper Canyon", elo: 1775 },
  { name: "Bronze Warrior", elo: 1765 },
  { name: "Platinum Star", elo: 1755 },
  { name: "Golden Eagle", elo: 1745 },
  { name: "Silver Streak", elo: 1735 },
  { name: "Crystal Clear", elo: 1725 },
  { name: "Diamond Edge", elo: 1715 },
  { name: "Ruby Flame", elo: 1705 },
  { name: "Emerald Dream", elo: 1695 },
  { name: "Sapphire Storm", elo: 1685 },
  { name: "Topaz Thunder", elo: 1675 },
  { name: "Amethyst Arrow", elo: 1665 },
  { name: "Opal Ocean", elo: 1655 },
  { name: "Garnet Glory", elo: 1645 },
  { name: "Turquoise Tide", elo: 1635 },
  { name: "Pearl Power", elo: 1625 },
  { name: "Jade Justice", elo: 1615 },
  { name: "Onyx Odyssey", elo: 1605 },
  { name: "Marble Majesty", elo: 1795 },
  { name: "Granite Guardian", elo: 1780 },
  { name: "Quartz Quest", elo: 1770 },
  { name: "Flint Fire", elo: 1760 },
  { name: "Slate Storm", elo: 1750 },
  { name: "Shale Shadow", elo: 1740 },
  { name: "Limestone Lightning", elo: 1730 },
  { name: "Sandstone Spirit", elo: 1720 },
  { name: "Basalt Blaze", elo: 1710 },
  { name: "Obsidian Oracle", elo: 1700 },

  // Competitive Horses (1400-1599) - 40 more
  { name: "Arctic Fox", elo: 1590 },
  { name: "Desert Rose", elo: 1585 },
  { name: "Mountain Lion", elo: 1575 },
  { name: "Prairie Wolf", elo: 1565 },
  { name: "Forest Ranger", elo: 1555 },
  { name: "Ocean Warrior", elo: 1545 },
  { name: "River Guardian", elo: 1535 },
  { name: "Lake Legend", elo: 1525 },
  { name: "Valley Victor", elo: 1515 },
  { name: "Hill Hero", elo: 1505 },
  { name: "Canyon Crusader", elo: 1495 },
  { name: "Mesa Master", elo: 1485 },
  { name: "Plateau Pioneer", elo: 1475 },
  { name: "Ridge Runner", elo: 1465 },
  { name: "Peak Performer", elo: 1455 },
  { name: "Summit Seeker", elo: 1445 },
  { name: "Cliff Climber", elo: 1435 },
  { name: "Rock Racer", elo: 1425 },
  { name: "Stone Stallion", elo: 1415 },
  { name: "Boulder Beast", elo: 1405 },
  { name: "Pebble Prince", elo: 1595 },
  { name: "Sand Surfer", elo: 1580 },
  { name: "Dust Devil", elo: 1570 },
  { name: "Wind Whisperer", elo: 1560 },
  { name: "Breeze Bringer", elo: 1550 },
  { name: "Gale Guardian", elo: 1540 },
  { name: "Storm Striker", elo: 1530 },
  { name: "Thunder Thief", elo: 1520 },
  { name: "Lightning Lancer", elo: 1510 },
  { name: "Rain Rider", elo: 1500 },
  { name: "Snow Sprinter", elo: 1490 },
  { name: "Ice Interceptor", elo: 1480 },
  { name: "Frost Fighter", elo: 1470 },
  { name: "Hail Hunter", elo: 1460 },
  { name: "Sleet Slayer", elo: 1450 },
  { name: "Mist Maker", elo: 1440 },
  { name: "Fog Fighter", elo: 1430 },
  { name: "Cloud Chaser", elo: 1420 },
  { name: "Sky Sailor", elo: 1410 },
  { name: "Star Striker", elo: 1400 },

  // Underdogs (1200-1399) - 40 more
  { name: "Midnight Oil", elo: 1390 },
  { name: "Dawn Patrol", elo: 1385 },
  { name: "Sunrise Special", elo: 1375 },
  { name: "Sunset Serenade", elo: 1365 },
  { name: "Twilight Zone", elo: 1355 },
  { name: "Dusk Dancer", elo: 1345 },
  { name: "Evening Star", elo: 1335 },
  { name: "Night Owl", elo: 1325 },
  { name: "Morning Glory", elo: 1315 },
  { name: "Afternoon Delight", elo: 1305 },
  { name: "Noon Day Sun", elo: 1295 },
  { name: "High Noon", elo: 1285 },
  { name: "Witching Hour", elo: 1275 },
  { name: "Golden Hour", elo: 1265 },
  { name: "Blue Hour", elo: 1255 },
  { name: "Magic Hour", elo: 1245 },
  { name: "Rush Hour", elo: 1235 },
  { name: "Happy Hour", elo: 1225 },
  { name: "Power Hour", elo: 1215 },
  { name: "Final Hour", elo: 1205 },
  { name: "Spring Forward", elo: 1395 },
  { name: "Summer Breeze", elo: 1380 },
  { name: "Autumn Leaves", elo: 1370 },
  { name: "Winter Frost", elo: 1360 },
  { name: "April Showers", elo: 1350 },
  { name: "May Flowers", elo: 1340 },
  { name: "June Bug", elo: 1330 },
  { name: "July Heat", elo: 1320 },
  { name: "August Storm", elo: 1310 },
  { name: "September Song", elo: 1300 },
  { name: "October Sky", elo: 1290 },
  { name: "November Rain", elo: 1280 },
  { name: "December Snow", elo: 1270 },
  { name: "January Thaw", elo: 1260 },
  { name: "February Freeze", elo: 1250 },
  { name: "March Madness", elo: 1240 },
  { name: "Leap Year", elo: 1230 },
  { name: "New Year", elo: 1220 },
  { name: "Old Timer", elo: 1210 },
  { name: "Time Keeper", elo: 1200 },

  // Long Shots (1000-1199) - 40 more
  { name: "Lucky Strike", elo: 1190 },
  { name: "Fortune Teller", elo: 1185 },
  { name: "Chance Encounter", elo: 1175 },
  { name: "Random Walk", elo: 1165 },
  { name: "Wild Card", elo: 1155 },
  { name: "Dark Horse", elo: 1145 },
  { name: "Long Shot", elo: 1135 },
  { name: "Underdog", elo: 1125 },
  { name: "Sleeper Hit", elo: 1115 },
  { name: "Hidden Gem", elo: 1105 },
  { name: "Secret Weapon", elo: 1095 },
  { name: "Surprise Package", elo: 1085 },
  { name: "Unexpected Guest", elo: 1075 },
  { name: "Plot Twist", elo: 1065 },
  { name: "Game Changer", elo: 1055 },
  { name: "Rule Breaker", elo: 1045 },
  { name: "Trend Setter", elo: 1035 },
  { name: "Pace Maker", elo: 1025 },
  { name: "Trail Blazer", elo: 1015 },
  { name: "Path Finder", elo: 1005 },
  { name: "Road Runner", elo: 1195 },
  { name: "Street Smart", elo: 1180 },
  { name: "City Slicker", elo: 1170 },
  { name: "Country Boy", elo: 1160 },
  { name: "Small Town", elo: 1150 },
  { name: "Big City", elo: 1140 },
  { name: "Main Street", elo: 1130 },
  { name: "Back Road", elo: 1120 },
  { name: "Side Street", elo: 1110 },
  { name: "Dead End", elo: 1100 },
  { name: "One Way", elo: 1090 },
  { name: "Two Way", elo: 1080 },
  { name: "Three Way", elo: 1070 },
  { name: "Four Way", elo: 1060 },
  { name: "Five Star", elo: 1050 },
  { name: "Six Pack", elo: 1040 },
  { name: "Seven Eleven", elo: 1030 },
  { name: "Eight Ball", elo: 1020 },
  { name: "Nine Lives", elo: 1010 },
  { name: "Perfect Ten", elo: 1000 },

  // Extreme Long Shots (800-999) - 30 more
  { name: "Hail Mary", elo: 990 },
  { name: "Wing and Prayer", elo: 985 },
  { name: "Hope Springs", elo: 975 },
  { name: "Faith Keeper", elo: 965 },
  { name: "Believe It", elo: 955 },
  { name: "Never Say Die", elo: 945 },
  { name: "Against All Odds", elo: 935 },
  { name: "Miracle Mile", elo: 925 },
  { name: "Divine Intervention", elo: 915 },
  { name: "Acts of God", elo: 905 },
  { name: "Higher Power", elo: 895 },
  { name: "Guardian Angel", elo: 885 },
  { name: "Saving Grace", elo: 875 },
  { name: "Amazing Grace", elo: 865 },
  { name: "Leap of Faith", elo: 855 },
  { name: "Blind Faith", elo: 845 },
  { name: "True Believer", elo: 835 },
  { name: "Faithful Friend", elo: 825 },
  { name: "Loyal Companion", elo: 815 },
  { name: "Steady Eddie", elo: 805 },
  { name: "Slow and Steady", elo: 995 },
  { name: "Tortoise Tale", elo: 980 },
  { name: "Patient Zero", elo: 970 },
  { name: "Waiting Game", elo: 960 },
  { name: "Good Things Come", elo: 950 },
  { name: "Better Late", elo: 940 },
  { name: "Never Too Late", elo: 930 },
  { name: "Second Chance", elo: 920 },
  { name: "Third Time", elo: 910 },
  { name: "Fourth Quarter", elo: 900 },
  { name: "Fifth Element", elo: 890 },
  { name: "Sixth Sense", elo: 880 },
  { name: "Seventh Heaven", elo: 870 },
  { name: "Eighth Wonder", elo: 860 },
  { name: "Ninth Inning", elo: 850 },
  { name: "Tenth Hour", elo: 840 },
  { name: "Eleventh Hour", elo: 830 },
  { name: "Twelfth Night", elo: 820 },
  { name: "Baker's Dozen", elo: 810 },
  { name: "Lucky Thirteen", elo: 800 },

  // Additional Fun Categories - 40 more
  { name: "Pizza Slice", elo: 790 },
  { name: "Burger King", elo: 785 },
  { name: "Taco Tuesday", elo: 775 },
  { name: "Sushi Roll", elo: 765 },
  { name: "Pasta La Vista", elo: 755 },
  { name: "Donut Worry", elo: 745 },
  { name: "Ice Cream Dream", elo: 735 },
  { name: "Cookie Monster", elo: 725 },
  { name: "Cake Walk", elo: 715 },
  { name: "Pie in Sky", elo: 705 },
  { name: "Bread Winner", elo: 695 },
  { name: "Butter Cup", elo: 685 },
  { name: "Honey Bee", elo: 675 },
  { name: "Sugar High", elo: 665 },
  { name: "Salt of Earth", elo: 655 },
  { name: "Pepper Pot", elo: 645 },
  { name: "Spice of Life", elo: 635 },
  { name: "Herb Garden", elo: 625 },
  { name: "Mint Condition", elo: 615 },
  { name: "Vanilla Sky", elo: 605 },
  { name: "Chocolate Rain", elo: 595 },
  { name: "Strawberry Fields", elo: 585 },
  { name: "Blueberry Hill", elo: 575 },
  { name: "Raspberry Beret", elo: 565 },
  { name: "Blackberry Smoke", elo: 555 },
  { name: "Cherry Bomb", elo: 545 },
  { name: "Apple Pie", elo: 535 },
  { name: "Orange Crush", elo: 525 },
  { name: "Lemon Drop", elo: 515 },
  { name: "Lime Light", elo: 505 },
  { name: "Grape Expectations", elo: 495 },
  { name: "Banana Republic", elo: 485 },
  { name: "Pineapple Express", elo: 475 },
  { name: "Coconut Grove", elo: 465 },
  { name: "Mango Tango", elo: 455 },
  { name: "Peach Fuzz", elo: 445 },
  { name: "Plum Crazy", elo: 435 },
  { name: "Apricot Sunset", elo: 425 },
  { name: "Kiwi Bird", elo: 415 },
  { name: "Papaya Paradise", elo: 405 },

  // LEGENDARY TIER - Mythical Horses (2000+ ELO) - The absolute best
  { name: "Secretariat Reborn", elo: 2100 },
  { name: "Eclipse Eternal", elo: 2090 },
  { name: "Phar Lap's Ghost", elo: 2080 },
  { name: "Man O War II", elo: 2070 },
  { name: "Citation Supreme", elo: 2060 },
  { name: "Seattle Slew's Heir", elo: 2050 },
  { name: "Affirmed Forever", elo: 2040 },
  { name: "War Admiral's Spirit", elo: 2030 },
  { name: "Count Fleet's Legacy", elo: 2020 },
  { name: "Whirlaway's Dream", elo: 2010 },
  { name: "Assault's Revenge", elo: 2000 },

  // More Legendary Horses (1950-1999) - Hall of Fame level
  { name: "Thunder God", elo: 1995 },
  { name: "Lightning Emperor", elo: 1990 },
  { name: "Storm King", elo: 1985 },
  { name: "Fire Lord", elo: 1980 },
  { name: "Ice Queen", elo: 1975 },
  { name: "Wind Master", elo: 1970 },
  { name: "Earth Shaker", elo: 1965 },
  { name: "Sky Ruler", elo: 1960 },
  { name: "Ocean Sovereign", elo: 1955 },
  { name: "Mountain Monarch", elo: 1950 },

  // Historical Racing Legends
  { name: "Black Caviar's Shadow", elo: 2095 },
  { name: "Frankel's Fury", elo: 2085 },
  { name: "Zenyatta's Grace", elo: 2075 },
  { name: "American Pharoah's Pride", elo: 2065 },
  { name: "Justify's Justice", elo: 2055 },
  { name: "California Chrome's Shine", elo: 2045 },
  { name: "Arrogate's Arrow", elo: 2035 },
  { name: "Gun Runner's Bullet", elo: 2025 },
  { name: "Winx's Wings", elo: 2015 },
  { name: "Enable's Power", elo: 2005 },

  // Mythical Creatures - Ultimate Tier
  { name: "Sleipnir's Thunder", elo: 2110 }, // Odin's 8-legged horse
  { name: "Pegasus Prime", elo: 2105 },
  { name: "Unicorn's Horn", elo: 2098 },
  { name: "Phoenix Reborn", elo: 2092 },
  { name: "Dragon's Breath", elo: 2087 },
  { name: "Centaur's Wisdom", elo: 2082 },
  { name: "Griffin's Flight", elo: 2077 },
  { name: "Hippogriff's Soar", elo: 2072 },
  { name: "Kelpie's Wave", elo: 2067 },
  { name: "Nightmare's Shadow", elo: 2062 }
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

// Calculate odds based on ELO ratings of horses in the race
export function calculateOddsFromELO(horses: HorseData[]): { name: string; odds: number }[] {
  // Sort horses by ELO descending to ensure proper ranking
  const sortedHorses = [...horses].sort((a, b) => b.elo - a.elo);
  
  // Calculate relative strength based on ELO differences
  const probabilities = sortedHorses.map(horse => {
    // Calculate this horse's strength relative to all others
    let totalStrength = 0;
    let thisHorseStrength = 0;
    
    sortedHorses.forEach(h => {
      // Use exponential scaling to make ELO differences MUCH more dramatic
      const strength = Math.pow(10, h.elo / 400); // Chess-like ELO scaling
      totalStrength += strength;
      if (h.name === horse.name) {
        thisHorseStrength = strength;
      }
    });
    
    // Base probability from relative strength
    let probability = thisHorseStrength / totalStrength;
    
    // Apply tier-based multipliers for even more dramatic differences
    if (horse.elo >= 2000) {
      probability *= 1.5; // Mythical boost
    } else if (horse.elo >= 1900) {
      probability *= 1.3; // Legendary boost
    } else if (horse.elo >= 1800) {
      probability *= 1.2; // Champion boost
    } else if (horse.elo >= 1600) {
      probability *= 1.1; // Elite boost
    } else if (horse.elo < 1000) {
      probability *= 0.7; // Weak penalty
    } else if (horse.elo < 800) {
      probability *= 0.5; // Very weak penalty
    }
    
    return { name: horse.name, probability: Math.max(0.005, probability) };
  });
  
  // Normalize probabilities
  const totalProb = probabilities.reduce((sum, p) => sum + p.probability, 0);
  const normalizedProbs = probabilities.map(p => ({
    name: p.name,
    probability: p.probability / totalProb
  }));
  
  // Convert to odds with minimal house edge
  return normalizedProbs.map(p => {
    const adjustedProb = p.probability * 0.98;
    let odds = 1 / adjustedProb;
    
    // Round appropriately
    if (odds < 1.5) {
      odds = Math.round(odds * 100) / 100;
    } else if (odds < 5) {
      odds = Math.round(odds * 20) / 20;
    } else if (odds < 15) {
      odds = Math.round(odds * 10) / 10;
    } else if (odds < 50) {
      odds = Math.round(odds * 2) / 2;
    } else {
      odds = Math.round(odds);
    }
    
    return {
      name: p.name,
      odds: Math.max(1.01, odds)
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