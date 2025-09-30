# 🏇 Horse Racing Simulation

An immersive 3D horse racing simulation game built with Next.js, React Three Fiber, and TypeScript. Experience the thrill of sprint racing with realistic ELO-based odds, dynamic weather conditions, and exciting photo finishes.

![Horse Racing Simulation](https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80)

## 🎮 Live Demo

**Play Now:** [https://25783102-2d19-4c46-8b15-607b3e0a5550.canvases.tempo.build](https://25783102-2d19-4c46-8b15-607b3e0a5550.canvases.tempo.build)

## ✨ Features

### 🏁 Core Racing Experience
- **1200m Sprint Races** - Fast-paced races with 20-second duration
- **8-Horse Fields** - Compete with randomly generated horses each race
- **Real-time 3D Racing** - Immersive 3D track with smooth animations
- **Dynamic Camera System** - Follows the leading horse during races
- **Photo Finish Detection** - Automatic photo finish for close races (within 150ms)

### 🐎 Horse System
- **ELO Rating System** - Horses rated from 320-1970 ELO
- **Tier-Based Classification** - Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster
- **Realistic Attributes** - Speed, stamina, and acceleration affect performance
- **Dynamic Odds Calculation** - Betting odds based on ELO ratings and tier differences
- **Unique Personalities** - Each horse has distinct racing characteristics

### 🎯 Advanced Racing Mechanics
- **Pack Racing Phase** (0-35%) - Horses stay grouped with tactical positioning
- **Sprint Phase** (35-100%) - Individual sprint timing and stamina management
- **Weather Conditions** - Dynamic day/night cycles and rain effects
- **Lane Consistency** - Horses maintain proper lane assignments throughout
- **Realistic Physics** - Fatigue effects and acceleration curves

### 🎨 Visual Features
- **3D Race Track** - Detailed track with grandstands and spectators
- **Weather System** - Clear/rainy conditions with twilight racing (15% chance)
- **Starting Gates** - Authentic racing barriers and lane markers
- **Live Standings** - Real-time position tracking during races
- **Glassmorphism UI** - Modern, translucent interface design

### 🎲 Betting & Results
- **Betting System** - Place bets with realistic odds (1.2:1 to 15:1)
- **Payout Calculations** - Accurate winnings based on odds
- **Detailed Results** - Complete race statistics and finish times
- **Podium Ceremony** - Celebrate top 3 finishers
- **Race Replay** - Watch highlights after completion

## 🛠️ Technology Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **3D Graphics:** React Three Fiber + Three.js
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Animations:** Framer Motion
- **Icons:** Lucide React

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kuusoucloud/horseraceingsimulator.git
   cd horseraceingsimulator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎮 How to Play

### 1. **Pre-Race Phase**
- View the 8-horse lineup with ELO ratings and odds
- Horses are automatically ranked by ELO (highest first)
- Each horse shows tier badge (Bronze to Grandmaster)
- Auto-start timer counts down from 10 seconds

### 2. **Betting (Optional)**
- Click any horse to open betting dialog
- Set bet amount ($1-$1000)
- View potential winnings based on odds
- Confirm bet before race starts

### 3. **Race Countdown**
- 10-second countdown with visual timer
- Horses positioned at starting gates
- Camera focuses on starting line

### 4. **Racing Phase**
- **Pack Phase (0-35%):** Horses stay grouped tactically
- **Sprint Phase (35-100%):** Individual sprint timing kicks in
- Watch live standings update in real-time
- Camera follows the leading horse

### 5. **Photo Finish**
- Triggered when top horses finish within 150ms
- Special camera angle for dramatic effect
- Automatic determination of winner

### 6. **Results**
- Podium ceremony for top 3 finishers
- Complete race statistics and times
- Betting payout calculations
- Option to watch replay or start new race

## 🏆 Horse Tiers & ELO System

| Tier | ELO Range | Badge Color | Typical Odds |
|------|-----------|-------------|--------------|
| **Grandmaster** | 1800+ | Purple | 1.2:1 - 2.5:1 |
| **Master** | 1600-1799 | Red | 2.0:1 - 4.0:1 |
| **Diamond** | 1400-1599 | Blue | 3.0:1 - 6.0:1 |
| **Platinum** | 1200-1399 | Cyan | 4.0:1 - 8.0:1 |
| **Gold** | 1000-1199 | Yellow | 6.0:1 - 10.0:1 |
| **Silver** | 800-999 | Gray | 8.0:1 - 12.0:1 |
| **Bronze** | 320-799 | Orange | 10.0:1 - 15.0:1 |

## 🌦️ Weather System

- **Clear Day** (65% chance) - Optimal racing conditions
- **Rainy Day** (20% chance) - Wet track affects visibility
- **Twilight Clear** (12% chance) - Beautiful sunset racing
- **Twilight Rain** (3% chance) - Rare dramatic conditions

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main application component
│   └── globals.css           # Global styles
├── components/
│   ├── HorseLineup.tsx       # Horse selection and betting
│   ├── RaceTrack.tsx         # 3D race visualization
│   ├── RaceController.tsx    # Race logic and timing
│   ├── RaceResults.tsx       # Results and replay
│   └── ui/                   # shadcn/ui components
├── data/
│   └── horses.ts             # Horse database and ELO system
├── types/
│   └── horse.ts              # TypeScript interfaces
└── lib/
    └── utils.ts              # Utility functions
```

## 🎯 Key Components

### **HorseLineup**
- Displays 8 horses sorted by ELO rating
- Interactive betting interface
- Real-time odds calculation
- Tier-based visual styling

### **RaceTrack** 
- 3D race environment with Three.js
- Dynamic weather and lighting
- Smooth horse animations
- Camera system following action

### **RaceController**
- Race timing and physics simulation
- Pack racing and sprint mechanics
- Progress tracking and updates
- Photo finish detection

### **RaceResults**
- Podium ceremony visualization
- Detailed race statistics
- Betting payout calculations
- Replay functionality

## 🔧 Configuration

### Race Settings
- **Race Distance:** 1200 meters
- **Race Duration:** ~20 seconds
- **Update Frequency:** 100ms intervals
- **Photo Finish Threshold:** 150ms

### Betting Limits
- **Minimum Bet:** $1
- **Maximum Bet:** $1000
- **Odds Range:** 1.2:1 to 15:1

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **React Three Fiber** - For amazing 3D capabilities
- **shadcn/ui** - For beautiful UI components  
- **Framer Motion** - For smooth animations
- **Unsplash** - For placeholder images
- **Lucide** - For consistent iconography

## 🐛 Known Issues

- Occasional camera jitter during very close races
- Weather transitions may cause brief visual glitches
- Mobile performance optimization needed

## 🚧 Roadmap

- [ ] Mobile responsive design
- [ ] Multiplayer betting rooms
- [ ] Horse breeding system
- [ ] Tournament mode
- [ ] Sound effects and music
- [ ] Historical race statistics
- [ ] Custom horse creation

---

**Built with ❤️ using Next.js and React Three Fiber**

*Experience the thrill of horse racing with realistic ELO-based competition!*