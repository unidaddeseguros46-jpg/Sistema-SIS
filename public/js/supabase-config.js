// Detección automática de entorno
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Configuración de Producción (Supabase Cloud)
const prodUrl = 'https://vofqatqocfaqcdcuwama.supabase.co';
const prodKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZnFhdHFvY2ZhcWNkY3V3YW1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTY3NjIsImV4cCI6MjA5MTIzMjc2Mn0.L4oGeOYh0Eq-VkHduJJT8veh9mMM--_Gg6HAaaJcaMc';

// Configuración de Desarrollo Local (Supabase CLI / Docker)
const localUrl = 'http://127.0.0.1:54321';
const localKey = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const supabaseUrl = isLocal ? localUrl : prodUrl;
const supabaseKey = isLocal ? localKey : prodKey;

// Las Edge Functions se sirven localmente con: npx supabase functions serve
// Cuando está en local apunta a 127.0.0.1:54321, igual que la BD.
const edgeFunctionUrl = isLocal ? localUrl : prodUrl;

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

console.log(`[Supabase] Conectado a: ${isLocal ? 'ENTORNO LOCAL (Pruebas)' : 'PRODUCCIÓN (Real)'}`);