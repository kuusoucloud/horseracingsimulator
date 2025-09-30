import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getHorseRank } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Horse {
  name: string;
  elo: number;
  total_races: number;
  wins: number;
  recent_form: number[];
}

interface EloLeaderboardProps {
  refreshTrigger?: number; // Prop to trigger refresh after races
}

export default function EloLeaderboard({ refreshTrigger = 0 }: EloLeaderboardProps = {}) {
  const [leaderboard, setLeaderboard] = useState<Horse[]>([]);
  const [topHorses, setTopHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);

  // ELO Tiers definition - all tiers restored with Mythical as pink, Rookie removed
  const eloTiers = [
    { name: 'Mythical', threshold: 2000, bg: 'bg-pink-500/10', border: 'border-pink-500/30', textColor: 'text-pink-300' },
    { name: 'Legendary', threshold: 1900, bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', textColor: 'text-yellow-300' },
    { name: 'Champion', threshold: 1800, bg: 'bg-orange-500/10', border: 'border-orange-500/30', textColor: 'text-orange-300' },
    { name: 'Elite', threshold: 1700, bg: 'bg-blue-500/10', border: 'border-blue-500/30', textColor: 'text-blue-300' },
    { name: 'Expert', threshold: 1600, bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', textColor: 'text-cyan-300' },
    { name: 'Skilled', threshold: 1500, bg: 'bg-green-500/10', border: 'border-green-500/30', textColor: 'text-green-300' },
    { name: 'Competent', threshold: 1400, bg: 'bg-lime-500/10', border: 'border-lime-500/30', textColor: 'text-lime-300' },
    { name: 'Promising', threshold: 1300, bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', textColor: 'text-emerald-300' },
    { name: 'Developing', threshold: 1200, bg: 'bg-teal-500/10', border: 'border-teal-500/30', textColor: 'text-teal-300' },
    { name: 'Novice', threshold: 1000, bg: 'bg-red-500/10', border: 'border-red-500/30', textColor: 'text-red-300' }
  ];

  const refreshLeaderboard = async () => {
    try {
      setLoading(true);
      console.log('🏆 Fetching ELO leaderboard from database...');
      
      const { data: horses, error } = await supabase
        .from('horses')
        .select('name, elo, total_races, wins, recent_form')
        .order('elo', { ascending: false })
        .limit(50); // Get top 50 horses
      
      if (error) {
        console.error('Error fetching leaderboard:', error);
        return;
      }
      
      const horsesData = horses || [];
      setLeaderboard(horsesData);
      setTopHorses(horsesData.slice(0, 8));
      console.log('🏆 ELO Leaderboard refreshed from database:', horsesData.slice(0, 5));
      
    } catch (error) {
      console.error('Error refreshing leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshLeaderboard();
  }, [refreshTrigger]);

  // Set up real-time subscription for horse updates
  useEffect(() => {
    console.log('🔄 Setting up real-time subscription for horses table...');
    
    const subscription = supabase
      .channel('horses-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'horses' 
        }, 
        (payload) => {
          console.log('🔄 Horse data changed, refreshing leaderboard...', payload);
          refreshLeaderboard();
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up real-time subscription...');
      subscription.unsubscribe();
    };
  }, []);

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all ELO ratings to 500? This cannot be undone.')) {
      try {
        console.log('🔄 Resetting all ELO ratings...');
        
        const { error } = await supabase
          .from('horses')
          .update({ 
            elo: 500, 
            total_races: 0, 
            wins: 0, 
            recent_form: [],
            updated_at: new Date().toISOString()
          })
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all horses
        
        if (error) {
          console.error('Error resetting ELO ratings:', error);
          return;
        }
        
        console.log('✅ All ELO ratings reset to 500');
        refreshLeaderboard();
        
      } catch (error) {
        console.error('Error resetting ELO ratings:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[300px] bg-transparent overflow-hidden">
        <div className="relative z-10 p-2 h-full">
          <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm rounded-xl border border-white/10 shadow-2xl p-2 h-full flex items-center justify-center">
            <div className="text-white/60">Loading ELO leaderboard...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[300px] bg-transparent overflow-hidden">
      <div className="relative z-10 p-2 h-full">
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm rounded-xl border border-white/10 shadow-2xl p-2 h-full flex flex-col">
          {/* Header */}
          <motion.div
            className="flex items-center justify-between mb-1"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <h2 className="text-sm font-bold text-white">ELO Leaderboard</h2>
              <Badge className="bg-green-500/20 border-green-400/50 text-green-300 text-xs">
                Live
              </Badge>
            </div>
            <Button
              onClick={handleReset}
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          </motion.div>

          <div className="flex-1 flex gap-3 min-h-0">
            {/* Top Horses - Landscape grid */}
            <div className="flex-1">
              {topHorses.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-white/60 text-center">
                    <Trophy className="w-8 h-8 mx-auto mb-2 text-white/40" />
                    <p className="text-sm">No horses yet</p>
                    <p className="text-xs text-white/40">Complete races to see rankings</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 h-full">
                  {topHorses.map((horse, index) => {
                    const rank = getHorseRank(horse.elo);
                    return (
                      <motion.div
                        key={horse.name}
                        className={`${rank.bgColor} p-2 rounded-lg border ${rank.borderColor} shadow-lg relative overflow-hidden flex flex-col h-full`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: index * 0.05 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        {/* Rank number */}
                        <div className="absolute top-1 left-1">
                          <span className="text-sm font-bold text-white/90">
                            {index + 1}
                          </span>
                        </div>

                        {/* ELO score - bigger */}
                        <div className="absolute top-1 right-1">
                          <span className="text-sm font-mono font-bold text-white">
                            {Math.round(horse.elo)}
                          </span>
                        </div>

                        {/* Horse name */}
                        <div className="mt-4 mb-2 flex-1">
                          <h3 className="text-xs font-bold text-white truncate leading-tight">
                            {horse.name}
                          </h3>
                        </div>

                        {/* Stats - moved up */}
                        <div className="space-y-1 mb-6">
                          <div className="flex items-center gap-1">
                            <Trophy className="w-2.5 h-2.5 text-yellow-400" />
                            <span className="text-xs text-white/80">
                              {horse.wins || 0}
                            </span>
                          </div>
                          
                          {/* Form - horizontal */}
                          <div className="flex items-center gap-0.5">
                            {horse.recent_form?.slice(0, 4).map((placement, formIndex) => (
                              <span
                                key={formIndex}
                                className={`text-xs font-bold px-0.5 py-0 rounded text-center min-w-[12px] h-3 flex items-center justify-center ${
                                  placement === 1 ? 'bg-yellow-500/30 text-yellow-300' :
                                  placement === 2 ? 'bg-gray-400/30 text-gray-300' :
                                  placement === 3 ? 'bg-orange-500/30 text-orange-300' :
                                  'bg-white/10 text-white/60'
                                }`}
                              >
                                {placement}
                              </span>
                            )) || <span className="text-xs text-white/40">-</span>}
                          </div>
                        </div>

                        {/* Rank badge */}
                        <div className="absolute bottom-1 left-1">
                          <span className={`px-1 py-0.5 rounded-full text-xs font-medium ${rank.textColor} bg-black/20`}>
                            {rank.name}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ELO Tiers - Grid layout to fit all */}
            <div className="w-60">
              <div className="grid grid-cols-2 gap-1">
                {eloTiers.map((tier, index) => (
                  <motion.div
                    key={tier.name}
                    className={`p-1 rounded-lg border ${tier.border} ${tier.bg} h-fit`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                  >
                    <div className="flex flex-col items-center text-center">
                      <span className={`font-medium text-xs ${tier.textColor}`}>
                        {tier.name}
                      </span>
                      <span className="text-white/60 text-xs">
                        {tier.threshold}+
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}