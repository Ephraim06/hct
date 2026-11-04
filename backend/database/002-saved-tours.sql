CREATE TABLE IF NOT EXISTS saved_tours (
 user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
 tour_slug text NOT NULL CHECK (tour_slug IN ('cape-point-penguins','cape-point-penguins-private-tour','cape-agulhas','chapmans-peak','capewinelands-stellenbosch','robben-island','safari-day-tour','whale-watching')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,tour_slug)
);
CREATE INDEX IF NOT EXISTS saved_tours_user_order ON saved_tours(user_id,created_at DESC);
