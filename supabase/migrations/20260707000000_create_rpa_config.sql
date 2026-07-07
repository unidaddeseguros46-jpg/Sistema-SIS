CREATE TABLE IF NOT EXISTS rpa_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tunnel_url text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO rpa_config (id, tunnel_url)
VALUES (1, 'https://damaged-halifax-lan-realized.trycloudflare.com')
ON CONFLICT (id) DO NOTHING;
