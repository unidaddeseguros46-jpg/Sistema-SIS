const host = window.location.hostname;
const isLocal = !host || host === 'localhost' || host === '127.0.0.1';

const prodUrl = 'https://vofqatqocfaqcdcuwama.supabase.co';
const prodKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZnFhdHFvY2ZhcWNkY3V3YW1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTY3NjIsImV4cCI6MjA5MTIzMjc2Mn0.L4oGeOYh0Eq-VkHduJJT8veh9mMM--_Gg6HAaaJcaMc';

const localUrl = 'http://127.0.0.1:54321';
const localKey = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const supabaseUrl = isLocal ? localUrl : prodUrl;
const supabaseKey = isLocal ? localKey : prodKey;
const edgeFunctionUrl = supabaseUrl;
const RPA_BASE = `${supabaseUrl}/functions/v1/rpa-proxy`;

const fetchWithTimeout = (url, options = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeout));
};

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
    global: { fetch: fetchWithTimeout },
    realtime: { reconnectAfterMs: Infinity }
});
