import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Validate request method
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get the caller's JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Create a client with the caller's JWT to verify their identity
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 4. Get the caller's session and role
    const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser();
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Get caller's role from perfiles
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

    // 6. Parse request body
    const { email, password, nombre_completo, id_rol } = await req.json();

    if (!email || !password || !nombre_completo || !id_rol) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email, password, nombre_completo, id_rol' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7. Authorization checks:
    // - Desarrollador (id_rol=1) can create Administrador (id_rol=2)
    // - Administrador (id_rol=2) can create Usuario (id_rol=3)
    // - Nobody can create Desarrollador (id_rol=1)
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

    // 8. Create user with service_role_key (admin privileges)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
    });

    if (createError) {
      const msg = createError.message || 'Failed to create user';
      const status = msg.includes('already been registered') ? 409 : 500;
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 9. Insert profile (trigger will uppercase nombre_completo)
    const { error: insertError } = await adminClient
      .from('perfiles')
      .insert({
        id_usuario: newUser.user.id,
        nombre_completo: nombre_completo,
        id_rol: id_rol,
        email: email, // New: include email in profile
      });

    if (insertError) {
      // Rollback: delete the auth user if profile insert fails
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: 'Failed to create profile: ' + insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 10. Return success
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        nombre_completo: nombre_completo.toUpperCase(),
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
