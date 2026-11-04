CREATE TABLE IF NOT EXISTS analytics_events (
 id uuid PRIMARY KEY,
 session_id uuid NOT NULL,
 visitor_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('page_view','tour_click','tour_save','enquiry','whatsapp','phone','email','enquiry_click')),
 path text NOT NULL CHECK(length(path)<=100),
 tour_slug text,
 source text NOT NULL CHECK(length(source)<=100),
 device text NOT NULL CHECK(device IN ('mobile','tablet','desktop')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_events_time ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS analytics_events_session ON analytics_events(session_id,created_at);
CREATE INDEX IF NOT EXISTS analytics_events_tour ON analytics_events(tour_slug,created_at) WHERE tour_slug IS NOT NULL;
