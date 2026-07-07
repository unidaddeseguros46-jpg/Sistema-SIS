param(
  [switch]$Production
)

# ── Config ──────────────────────────────────────────────────────────
$localSupabaseUrl = 'http://127.0.0.1:54321'
$localAnonKey = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
$localServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

$prodSupabaseUrl = 'https://vofqatqocfaqcdcuwama.supabase.co'
$prodAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZnFhdHFvY2ZhcWNkY3V3YW1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTY3NjIsImV4cCI6MjA5MTIzMjc2Mn0.L4oGeOYh0Eq-VkHduJJT8veh9mMM--_Gg6HAaaJcaMc'

# ── Elegir entorno ──────────────────────────────────────────────────
if ($Production) {
  $supabaseUrl = $prodSupabaseUrl
  $anonKey = $prodAnonKey
  $serviceKey = $env:SUPABASE_SERVICE_ROLE_KEY
  if (-not $serviceKey) {
    Write-Host "[ERROR] Variable SUPABASE_SERVICE_ROLE_KEY no definida."
    exit 1
  }
} else {
  $supabaseUrl = $localSupabaseUrl
  $anonKey = $localAnonKey
  $serviceKey = $localServiceKey
}

# ── Esperar túnel activo ──────────────────────────────────────────
$tunnelLog = "$env:USERPROFILE\.pm2\logs\Cloudflare-Tunnel-error.log"
$url = $null
$maxWait = 60
$waited = 0

Write-Host "[+] Esperando túnel Cloudflare..."

while ($waited -lt $maxWait) {
  if (Test-Path $tunnelLog) {
    $content = Get-Content $tunnelLog -Tail 100 | Out-String
    if ($content -match 'https://([a-z0-9-]+\.trycloudflare\.com)') {
      $url = $matches[0]
      break
    }
  }
  Start-Sleep -Seconds 2
  $waited += 2
}

if (-not $url) {
  Write-Host "[ERROR] No se detectó URL del túnel en $maxWait segundos."
  Write-Host "       Verifica que PM2 tenga Cloudflare-Tunnel corriendo."
  exit 1
}

Write-Host "[+] Tunnel URL: $url"

# ── Actualizar rpa_config vía REST API ────────────────────────────
$headers = @{
  apikey          = $anonKey
  Authorization   = "Bearer $serviceKey"
  'Content-Type'  = 'application/json'
  Prefer          = 'return=minimal'
}

$body = @{
  tunnel_url = $url
  updated_at = (Get-Date -Format "o")
} | ConvertTo-Json

$restUrl = "$supabaseUrl/rest/v1/rpa_config?id=eq.1"

try {
  Invoke-RestMethod -Uri $restUrl -Method Patch -Headers $headers -Body $body -UseBasicParsing | Out-Null
  Write-Host "[+] rpa_config actualizado en $supabaseUrl"
  Write-Host "[+] Proxy listo para usar: $url"
} catch {
  Write-Host "[ERROR] Falló actualización de rpa_config: $_"
  exit 1
}
