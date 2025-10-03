import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Horse {
  id: string;
  name: string;
  speed: number;
  stamina: number;
  acceleration: number;
  lane: number;
  position: number;
  elo: number;
  odds: number;
}

// Generate random horses for a race
function generateRaceHorses(): Horse[] {
  const horseNames = [
    "Thunder Bolt", "Lightning Strike", "Storm Chaser", "Wind Runner", "Fire Spirit",
    "Golden Arrow", "Silver Bullet", "Midnight Express", "Dawn Breaker", "Star Gazer",
    "Ocean Wave", "Mountain Peak", "Desert Storm", "Forest Fire", "Ice Crystal",
    "Ruby Flash", "Diamond Dust", "Emerald Dream", "Sapphire Sky", "Amber Light"
  ];

  const selectedNames = horseNames.sort(() => 0.5 - Math.random()).slice(0, 8);
  
  return selectedNames.map((name, index) => ({
    id: `horse-${index + 1}`,
    name,
    speed: 40 + Math.random() * 40, // 40-80
    stamina: 40 + Math.random() * 40, // 40-80
    acceleration: 40 + Math.random() * 40, // 40-80
    lane: index + 1,
    position: 0,
    elo: 450 + Math.random() * 100, // 450-550 starting ELO
    odds: 2 + Math.random() * 8 // 2-10 odds
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action } = await req.json();

    if (action === 'initialize_system') {
      console.log('🏇 Initializing race system...');

      // 1. Check if horses exist in database
      const { data: existingHorses, error: horsesError } = await supabase
        .from('horses')
        .select('*')
        .limit(1);

      if (horsesError) {
        throw new Error(`Horses table error: ${horsesError.message}`);
      }

      // 2. If no horses exist, create some
      if (!existingHorses || existingHorses.length === 0) {
        console.log('🏇 Creating initial horses...');
        const initialHorses = generateRaceHorses();
        
        const horsesToInsert = initialHorses.map(horse => ({
          name: horse.name,
          elo: horse.elo,
          total_races: 0,
          wins: 0,
          recent_form: []
        }));

        const { error: insertError } = await supabase
          .from('horses')
          .insert(horsesToInsert);

        if (insertError) {
          throw new Error(`Failed to create horses: ${insertError.message}`);
        }

        console.log(`✅ Created ${initialHorses.length} horses`);
      }

      // 3. Check current race state
      const { data: currentRace, error: raceError } = await supabase
        .from('race_state')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (raceError && raceError.code !== 'PGRST116') { // PGRST116 = no rows found
        throw new Error(`Race state error: ${raceError.message}`);
      }

      // 4. If no race exists or race is finished, start a new one
      if (!currentRace || currentRace.race_state === 'finished') {
        console.log('🏇 Starting new race...');
        
        // Get random horses from database
        const { data: dbHorses, error: fetchError } = await supabase
          .from('horses')
          .select('*')
          .order('RANDOM()')
          .limit(8);

        if (fetchError) {
          throw new Error(`Failed to fetch horses: ${fetchError.message}`);
        }

        // Create race horses with proper structure
        const raceHorses = dbHorses.map((horse, index) => ({
          id: `horse-${index + 1}`,
          name: horse.name,
          speed: 40 + Math.random() * 40,
          stamina: 40 + Math.random() * 40,
          acceleration: 40 + Math.random() * 40,
          lane: index + 1,
          position: 0,
          elo: horse.elo || 500,
          odds: 2 + Math.random() * 8
        }));

        // Calculate odds based on ELO
        const avgElo = raceHorses.reduce((sum, h) => sum + h.elo, 0) / raceHorses.length;
        raceHorses.forEach(horse => {
          const eloRatio = avgElo / horse.elo;
          horse.odds = Math.max(1.5, Math.min(15.0, eloRatio * 5.0));
        });

        // Create new race
        const { error: createError } = await supabase
          .from('race_state')
          .insert({
            race_state: 'pre-race',
            pre_race_timer: 10,
            countdown_timer: 0,
            race_timer: 0,
            results_countdown: 0,
            horses: raceHorses,
            show_photo_finish: false,
            show_results: false,
            race_results: [],
            photo_finish_results: [],
            weather_conditions: {
              timeOfDay: 'day',
              weather: 'clear',
              skyColor: '#87ceeb',
              ambientIntensity: 0.4,
              directionalIntensity: 1.0,
              trackColor: '#8B4513',
              grassColor: '#32cd32'
            }
          });

        if (createError) {
          throw new Error(`Failed to create race: ${createError.message}`);
        }

        console.log('✅ New race created with horses');
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Race system initialized successfully',
          horsesCount: existingHorses?.length || 0
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );

  } catch (error) {
    console.error('❌ Race initialization error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check server logs for more information'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});