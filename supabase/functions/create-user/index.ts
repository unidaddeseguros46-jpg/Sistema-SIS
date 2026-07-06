import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser();
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerProfile, error: profileError } = await callerClient
      .from('perfiles')
      .select('id_rol, roles(nombre)')
      .eq('id_usuario', callerUser.id)
      .single();

    if (profileError || !callerProfile) {
      return new Response(JSON.stringify({ error: 'Caller profile not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerRoleName = (callerProfile.roles as any)?.nombre || '';

    const { email, password, nombre_completo, apellidos, id_rol } = await req.json();

    if (!email || !password || !nombre_completo || !apellidos || !id_rol) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email, password, nombre_completo, apellidos, id_rol' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (id_rol === 1) {
      return new Response(JSON.stringify({ error: 'Cannot create Desarrollador users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (id_rol === 2 && callerRoleName !== 'Desarrollador') {
      return new Response(JSON.stringify({ error: 'Only Desarrollador can create Administrador users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (id_rol === 3 && callerRoleName !== 'Desarrollador' && callerRoleName !== 'Administrador') {
      return new Response(JSON.stringify({ error: 'Insufficient permissions to create users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    });

    if (createError) {
      const msg = createError.message || 'Failed to create user';
      const status = msg.includes('already been registered') ? 409 : 500;
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: insertError } = await adminClient
      .from('perfiles')
      .insert({
        id_usuario: newUser.user.id,
        nombre_completo: nombre_completo,
        apellidos: apellidos,
        id_rol: id_rol,
        email: email,
      });

    if (insertError) {

      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: 'Failed to create profile: ' + insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        nombre_completo: nombre_completo.toUpperCase(),
        apellidos: apellidos.toUpperCase(),
        id_rol: id_rol,
      },
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
