export interface HorseData {
  name: string;
  elo: number; // ELO rating instead of baseOdds
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
  { name: "Until Next Time", elo: 320 }
];

export function getRandomHorses(count: number = 8): HorseData[] {
  const shuffled = [...HORSE_DATABASE].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Calculate odds based on ELO ratings of horses in the race
export function calculateOddsFromELO(horses: HorseData[]): { name: string; odds: number }[] {
  // Calculate win probability for each horse using improved ELO system
  const probabilities = horses.map(horse => {
    // Use a more aggressive ELO scaling factor for better odds differentiation
    // Higher scaling factor = more dramatic odds differences
    const scalingFactor = 600; // Increased from 400 for more dramatic differences
    
    // Calculate expected score against each opponent and average it
    let totalExpectedScore = 0;
    horses.forEach(opponent => {
      if (opponent.name !== horse.name) {
        const expectedScore = 1 / (1 + Math.pow(10, (opponent.elo - horse.elo) / scalingFactor));
        totalExpectedScore += expectedScore;
      }
    });
    
    // Average expected score against all opponents
    const avgExpectedScore = totalExpectedScore / (horses.length - 1);
    
    // Apply additional factors to make odds more realistic
    // Boost high ELO horses slightly and penalize very low ELO horses
    let adjustedScore = avgExpectedScore;
    
    if (horse.elo >= 1800) {
      // Champions get a slight boost
      adjustedScore = Math.min(0.95, adjustedScore * 1.15);
    } else if (horse.elo >= 1600) {
      // Elite horses get a small boost
      adjustedScore = Math.min(0.90, adjustedScore * 1.08);
    } else if (horse.elo < 1000) {
      // Very weak horses get penalized more
      adjustedScore = adjustedScore * 0.85;
    } else if (horse.elo < 1200) {
      // Weak horses get penalized
      adjustedScore = adjustedScore * 0.92;
    }
    
    return { name: horse.name, probability: Math.max(0.01, adjustedScore) }; // Minimum 1% chance
  });
  
  // Normalize probabilities so they sum to 1
  const totalProb = probabilities.reduce((sum, p) => sum + p.probability, 0);
  const normalizedProbs = probabilities.map(p => ({
    name: p.name,
    probability: p.probability / totalProb
  }));
  
  // Convert probabilities to odds with some house edge and rounding
  return normalizedProbs.map(p => {
    // Add slight house edge (reduce probability by ~5%)
    const adjustedProb = p.probability * 0.95;
    let odds = 1 / adjustedProb;
    
    // Round odds to more realistic betting values
    if (odds < 2) {
      odds = Math.round(odds * 20) / 20; // Round to nearest 0.05
    } else if (odds < 5) {
      odds = Math.round(odds * 10) / 10; // Round to nearest 0.1
    } else if (odds < 20) {
      odds = Math.round(odds * 2) / 2; // Round to nearest 0.5
    } else {
      odds = Math.round(odds); // Round to nearest whole number
    }
    
    return {
      name: p.name,
      odds: Math.max(1.1, odds) // Minimum odds of 1.1:1
    };
  });
}