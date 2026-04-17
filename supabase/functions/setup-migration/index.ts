import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const results: Record<string, string> = {};

  // 1. Create photos storage bucket (public, no size/type restrictions)
  const { error: bucketErr } = await supabase.storage.createBucket('photos', {
    public: true,
    fileSizeLimit: null,
    allowedMimeTypes: null,
  });
  results.photos_bucket = bucketErr
    ? (bucketErr.message.includes('already exists') ? 'already exists ✓' : `error: ${bucketErr.message}`)
    : 'created ✓';

  // 2. Verify photos table exists
  const { error: tableErr } = await supabase.from('photos').select('id').limit(1);
  results.photos_table = tableErr ? `error: ${tableErr.message}` : 'exists ✓';

  // 3. Verify on_lock_screen column on notes
  const { error: notesErr } = await supabase
    .from('notes')
    .select('on_lock_screen')
    .limit(1);
  results.notes_on_lock_screen = notesErr ? `error: ${notesErr.message}` : 'exists ✓';

  // 4. Verify household_members pin column
  const { error: pinErr } = await supabase
    .from('household_members')
    .select('pin')
    .limit(1);
  results.members_pin = pinErr ? `error: ${pinErr.message}` : 'exists ✓';

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
