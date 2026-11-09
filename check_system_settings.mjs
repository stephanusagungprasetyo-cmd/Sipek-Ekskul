import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://ckciqfmuddkpzypiwpqi.supabase.co', 'sb_publishable_gr36m1wl54ZMVBBPbb6XNA_j9rSAQL3')

async function checkSystemSettings() {
  await supabase.auth.signInWithPassword({
    email: 'admin@sipek.local',
    password: 'adminP4Eks'
  })

  const { data, error } = await supabase.from('system_settings').select('*').limit(5)
  console.log('system_settings check:', data, error ? error.message : 'OK')
}

checkSystemSettings().catch(console.error)
