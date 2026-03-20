-- ============================================================
-- ThumbDrop — Schema SQL
-- Colle ce code dans l'éditeur SQL de Supabase et exécute-le
-- ============================================================

-- Profils joueurs (extension de auth.users)
CREATE TABLE profiles (
  id              UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username        TEXT UNIQUE NOT NULL,
  tubes           INTEGER NOT NULL DEFAULT 200,   -- monnaie principale
  crystals        INTEGER NOT NULL DEFAULT 10,    -- monnaie premium
  total_cards     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cartes YouTube (miniatures)
CREATE TABLE cards (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id        TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  thumbnail_url   TEXT NOT NULL,
  channel_name    TEXT NOT NULL,
  view_count      BIGINT NOT NULL DEFAULT 0,
  like_count      BIGINT NOT NULL DEFAULT 0,
  rarity          TEXT NOT NULL,   -- basic | rare | super_rare | epic | mythic | legendary | ultra_legendary | secret
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chaînes YouTube (possession unique)
CREATE TABLE yt_channels (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id      TEXT NOT NULL UNIQUE,
  channel_name    TEXT NOT NULL,
  subscriber_count BIGINT NOT NULL DEFAULT 0,
  thumbnail_url   TEXT NOT NULL,
  owner_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  obtained_at     TIMESTAMP WITH TIME ZONE
);

-- Inventaire des joueurs
CREATE TABLE inventory (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  card_id         UUID REFERENCES cards(id),           -- NULL si c'est une chaîne
  channel_id      UUID REFERENCES yt_channels(id),     -- NULL si c'est une carte
  obtained_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT one_type CHECK (
    (card_id IS NOT NULL AND channel_id IS NULL) OR
    (card_id IS NULL AND channel_id IS NOT NULL)
  )
);

-- Définition des missions
CREATE TABLE missions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type            TEXT NOT NULL,    -- daily | weekly
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  reward_tubes    INTEGER NOT NULL DEFAULT 0,
  reward_crystals INTEGER NOT NULL DEFAULT 0,
  reward_pack     TEXT,             -- NULL ou nom du pack offert
  target_count    INTEGER NOT NULL DEFAULT 1,
  action          TEXT NOT NULL     -- open_pack | collect_cards | login | reach_rarity
);

-- Progression des missions par joueur
CREATE TABLE player_missions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mission_id      UUID REFERENCES missions(id) ON DELETE CASCADE NOT NULL,
  progress        INTEGER NOT NULL DEFAULT 0,
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  claimed         BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(player_id, mission_id, expires_at)
);

-- Échanges (trades)
CREATE TABLE trades (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_player_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  to_player_id        UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  offered_inv_id      UUID REFERENCES inventory(id),
  requested_inv_id    UUID REFERENCES inventory(id),
  status              TEXT NOT NULL DEFAULT 'pending',   -- pending | accepted | declined | cancelled
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Classement quotidien (vue matérialisée mise à jour côté app)
CREATE VIEW leaderboard AS
  SELECT p.id, p.username, p.total_cards,
         COUNT(CASE WHEN c.rarity = 'legendary'       THEN 1 END) AS legendary_count,
         COUNT(CASE WHEN c.rarity = 'ultra_legendary'  THEN 1 END) AS ultra_legendary_count,
         COUNT(CASE WHEN c.rarity = 'secret'           THEN 1 END) AS secret_count,
         COUNT(CASE WHEN yt.id IS NOT NULL              THEN 1 END) AS channel_count
  FROM profiles p
  LEFT JOIN inventory i ON i.player_id = p.id
  LEFT JOIN cards c ON c.id = i.card_id
  LEFT JOIN yt_channels yt ON yt.id = i.channel_id
  GROUP BY p.id, p.username, p.total_cards
  ORDER BY p.total_cards DESC;

-- ==================== MISSIONS PAR DÉFAUT ====================
INSERT INTO missions (type, title, description, reward_tubes, reward_crystals, target_count, action) VALUES
  ('daily', 'Connexion du jour',       'Connecte-toi aujourd''hui',                              50,  0, 1,  'login'),
  ('daily', 'Ouvre un booster',        'Ouvre n''importe quel booster',                          80,  0, 1,  'open_pack'),
  ('daily', 'Collectionneur du jour',  'Obtiens 3 nouvelles miniatures',                        120,  0, 3,  'collect_cards'),
  ('weekly','Chasseur de raretés',     'Obtiens une carte Épique ou supérieure',                  0,  5, 1,  'reach_rarity'),
  ('weekly','Gros collectionneur',     'Ouvre 10 boosters dans la semaine',                     500, 10, 10, 'open_pack'),
  ('weekly','Bibliothèque YouTube',    'Accumule 25 nouvelles miniatures cette semaine',         300,  5, 25, 'collect_cards');

-- ==================== RLS (Row Level Security) ====================
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE yt_channels    ENABLE ROW LEVEL SECURITY;

-- Profiles : lecture publique, écriture par soi-même
CREATE POLICY "Lecture publique profils"      ON profiles FOR SELECT USING (true);
CREATE POLICY "Mise à jour propre profil"     ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Création propre profil"        ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Inventaire : lecture publique, écriture par soi-même
CREATE POLICY "Lecture publique inventaire"   ON inventory FOR SELECT USING (true);
CREATE POLICY "Insertion propre inventaire"   ON inventory FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Suppression propre inventaire" ON inventory FOR DELETE USING (auth.uid() = player_id);

-- Missions : lecture propre uniquement
CREATE POLICY "Lecture propres missions"      ON player_missions FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Insertion propres missions"    ON player_missions FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Update propres missions"       ON player_missions FOR UPDATE USING (auth.uid() = player_id);

-- Cards : lecture publique
CREATE POLICY "Lecture publique cartes"       ON cards FOR SELECT USING (true);
CREATE POLICY "Insertion cartes"              ON cards FOR INSERT WITH CHECK (true);

-- Chaînes : lecture publique
CREATE POLICY "Lecture publique chaînes"      ON yt_channels FOR SELECT USING (true);
CREATE POLICY "Insertion chaînes"             ON yt_channels FOR INSERT WITH CHECK (true);
CREATE POLICY "Update chaînes"                ON yt_channels FOR UPDATE USING (true);

-- Trades : lecture par les participants
CREATE POLICY "Lecture propres trades"        ON trades FOR SELECT USING (auth.uid() = from_player_id OR auth.uid() = to_player_id);
CREATE POLICY "Création trade"                ON trades FOR INSERT WITH CHECK (auth.uid() = from_player_id);
CREATE POLICY "Update trade"                  ON trades FOR UPDATE USING (auth.uid() = from_player_id OR auth.uid() = to_player_id);

-- Trigger : créer profil auto à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'username', 'Player_' || substr(new.id::text, 1, 6)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
