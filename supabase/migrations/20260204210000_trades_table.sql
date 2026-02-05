-- Gewerke-Tabelle für zentrale Verwaltung
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#fa432a',
  icon TEXT DEFAULT 'wrench',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index für Sortierung
CREATE INDEX idx_trades_sort ON trades(sort_order, label);

-- Initial-Daten einfügen
INSERT INTO trades (slug, label, sort_order) VALUES
  ('elektriker', 'Elektriker', 1),
  ('dachdecker', 'Dachdecker', 2),
  ('zimmerer', 'Zimmerer', 3),
  ('dc_montage', 'DC-Montage', 4),
  ('ac_montage', 'AC-Montage', 5),
  ('sanitaer', 'Sanitär', 6),
  ('heizung', 'Heizung', 7),
  ('klima', 'Klima', 8),
  ('geruestbau', 'Gerüstbau', 9),
  ('allround', 'Allround', 10)
ON CONFLICT (slug) DO NOTHING;

-- RLS deaktivieren (Admins verwalten)
ALTER TABLE trades DISABLE ROW LEVEL SECURITY;

-- GRANTs
GRANT ALL ON trades TO authenticated;
GRANT SELECT ON trades TO anon;
