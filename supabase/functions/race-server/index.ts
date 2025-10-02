import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Global race automation state
let isAutomationRunning = false;
let automationInterval: number | null = null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { action } = await req.json().catch(() => ({ action: 'tick' }));

    if (action === 'start_automation') {
      if (!isAutomationRunning) {
        console.log('🤖 Starting continuous race automation...');
        isAutomationRunning = true;
        
        // Start continuous automation
        automationInterval = setInterval(async () => {
          try {
            await runRaceTick(supabase);
          } catch (error) {
            console.error('❌ Automation tick error:', error);
          }
        }, 100); // 100ms intervals
        
        return new Response(
          JSON.stringify({ success: true, message: 'Race automation started' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ success: true, message: 'Race automation already running' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'stop_automation') {
      if (automationInterval) {
        clearInterval(automationInterval);
        automationInterval = null;
      }
      isAutomationRunning = false;
      console.log('🛑 Race automation stopped');
      
      return new Response(
        JSON.stringify({ success: true, message: 'Race automation stopped' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.action === 'force_new_race') {
      console.log('🔧 Force new race requested');
      await createNewRace(supabase);
      return new Response(JSON.stringify({ success: true, message: 'New race created' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default action: single tick
    await runRaceTick(supabase);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Race tick completed',
        automationRunning: isAutomationRunning,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Race server error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Race server error', 
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function runRaceTick(supabase: any) {
  console.log('🎯 Race tick at', new Date().toISOString());

  // Get current race
  const { data: currentRace, error: raceError } = await supabase
    .from('race_state')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (raceError) {
    console.error('❌ Error fetching race:', raceError);
    return;
  }

  const now = new Date();
  
  // If no race exists, create one
  if (!currentRace) {
    console.log('🆕 Creating new race...');
    await createNewRace(supabase);
    return;
  }

  const raceAge = (now.getTime() - new Date(currentRace.created_at).getTime()) / 1000;

  // Handle pre-race state (10 seconds)
  if (currentRace.race_state === 'pre-race') {
    const newTimer = Math.max(0, 10 - Math.floor(raceAge));
    
    await supabase
      .from('race_state')
      .update({ 
        pre_race_timer: newTimer,
        updated_at: now.toISOString()
      })
      .eq('id', currentRace.id);

    if (raceAge >= 10) {
      console.log('⏰ Pre-race complete, starting countdown...');
      await supabase
        .from('race_state')
        .update({
          race_state: 'countdown',
          countdown_timer: 5,
          countdown_start_time: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', currentRace.id);
    }
    return;
  }

  // Handle countdown state (5 seconds)
  if (currentRace.race_state === 'countdown') {
    const countdownStart = new Date(currentRace.countdown_start_time || currentRace.updated_at);
    const countdownAge = (now.getTime() - countdownStart.getTime()) / 1000;
    const newTimer = Math.max(0, 5 - Math.floor(countdownAge));
    
    await supabase
      .from('race_state')
      .update({ 
        countdown_timer: newTimer,
        updated_at: now.toISOString()
      })
      .eq('id', currentRace.id);

    if (countdownAge >= 5) {
      console.log('🏁 Countdown complete, starting race...');
      
      // Reset horse positions
      if (currentRace.horses) {
        const resetHorses = currentRace.horses.map((horse: any) => ({
          ...horse,
          position: 0,
          velocity: 0
        }));
        
        await supabase
          .from('race_state')
          .update({
            race_state: 'racing',
            race_start_time: now.toISOString(),
            race_timer: 0,
            horses: resetHorses,
            updated_at: now.toISOString()
          })
          .eq('id', currentRace.id);
      }
    }
    return;
  }

  // Handle racing state
  if (currentRace.race_state === 'racing') {
    const raceStart = new Date(currentRace.race_start_time);
    const raceDuration = (now.getTime() - raceStart.getTime()) / 1000;
    
    if (!currentRace.horses || currentRace.horses.length === 0) {
      console.log('❌ No horses in race, ending race');
      await endRace(supabase, currentRace.id);
      return;
    }

    // Move horses
    const updatedHorses = currentRace.horses.map((horse: any, index: number) => {
      const baseSpeed = 20 + (Math.random() * 10); // 20-30 m/s
      const currentPosition = horse.position || 0;
      const newPosition = Math.min(1200, currentPosition + (baseSpeed * 0.1)); // 0.1s tick
      
      return {
        ...horse,
        position: newPosition,
        velocity: baseSpeed
      };
    });

    // Check if race is complete
    const finishedHorses = updatedHorses.filter(h => h.position >= 1200);
    const isRaceComplete = finishedHorses.length >= updatedHorses.length || raceDuration > 60;

    if (isRaceComplete) {
      console.log('🏆 Race complete!');
      await supabase
        .from('race_state')
        .update({
          race_state: 'finished',
          horses: updatedHorses,
          race_end_time: now.toISOString(),
          show_results: true,
          updated_at: now.toISOString()
        })
        .eq('id', currentRace.id);
      
      // Don't use setTimeout - let the finished state handler create new race
    } else {
      // Update horse positions and race timer
      await supabase
        .from('race_state')
        .update({
          horses: updatedHorses,
          race_timer: Math.floor(raceDuration),
          updated_at: now.toISOString()
        })
        .eq('id', currentRace.id);
    }
    return;
  }

  // Handle finished state - create new race after 15 seconds
  if (currentRace.race_state === 'finished') {
    const finishAge = (now.getTime() - new Date(currentRace.race_end_time || currentRace.updated_at).getTime()) / 1000;
    
    console.log(`⏱️ Race finished ${finishAge.toFixed(1)}s ago, waiting for 15s to create new race...`);
    
    if (finishAge >= 15) {
      console.log('🆕 15 seconds elapsed, creating new race now...');
      
      // Delete the old finished race first to ensure clean state
      await supabase
        .from('race_state')
        .delete()
        .eq('id', currentRace.id);
      
      await createNewRace(supabase);
      console.log('✅ New race creation attempt completed');
    }
  }
}

async function createNewRace(supabase: any) {
  try {
    console.log('🔄 Starting new race creation process...');
    
    // Get random horses
    const { data: horses, error: horsesError } = await supabase
      .from('horses')
      .select('*')
      .limit(8);

    if (horsesError || !horses || horses.length === 0) {
      console.error('❌ Error fetching horses:', horsesError);
      return;
    }

    console.log(`🐎 Found ${horses.length} horses, creating race lineup...`);

    // Shuffle and select 8 horses
    const selectedHorses = horses
      .sort(() => Math.random() - 0.5)
      .slice(0, 8)
      .map((horse: any, index: number) => ({
        id: horse.id,
        name: horse.name,
        position: 0,
        lane: index + 1,
        elo: horse.elo || 500,
        odds: 2.0 + (Math.random() * 8.0),
        velocity: 0
      }));

    const now = new Date();
    
    console.log('💾 Inserting new race into database...');
    const { error: insertError } = await supabase
      .from('race_state')
      .insert({
        race_state: 'pre-race',
        horses: selectedHorses,
        pre_race_timer: 10,
        countdown_timer: 0,
        race_timer: 0,
        weather_conditions: {
          condition: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)],
          temperature: 10 + Math.floor(Math.random() * 20),
          humidity: 30 + Math.floor(Math.random() * 40),
          windSpeed: Math.floor(Math.random() * 20)
        },
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      });

    if (insertError) {
      console.error('❌ Error creating race:', insertError);
      console.error('❌ Insert error details:', JSON.stringify(insertError, null, 2));
    } else {
      console.log('✅ New race created successfully - race should start in pre-race state');
    }
  } catch (error) {
    console.error('❌ Error in createNewRace:', error);
    console.error('❌ Full error details:', JSON.stringify(error, null, 2));
  }
}

async function endRace(supabase: any, raceId: string) {
  const now = new Date();
  await supabase
    .from('race_state')
    .update({
      race_state: 'finished',
      race_end_time: now.toISOString(),
      show_results: true,
      updated_at: now.toISOString()
    })
    .eq('id', raceId);
}