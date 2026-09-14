import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Yalnizca POST destekleniyor.' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Oturum bulunamadi.' }, 401);
  }

  // Kimligi kullanicinin kendi tokeni ile dogrula.
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Oturum gecersiz.' }, 401);
  }

  const userId = userData.user.id;

  // Silme islemi yalnizca service_role ile yapilabilir.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // auth.users silinince tum tablolardaki satirlar cascade ile gider.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.log('DELETE ACCOUNT ERROR:', deleteError.message);
    return json({ error: 'Hesap silinemedi.' }, 500);
  }

  return json({ ok: true });
});