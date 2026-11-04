ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'gallery' CHECK(purpose IN ('gallery','hero'));
CREATE TABLE IF NOT EXISTS gallery_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 hero_image_id uuid REFERENCES gallery_images(id) ON DELETE SET NULL
);
INSERT INTO gallery_settings(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS enquiries (
 id uuid PRIMARY KEY,
 payload_hash text NOT NULL,
 first_name text NOT NULL,last_name text NOT NULL,email text NOT NULL,phone text NOT NULL DEFAULT '',
 tour text NOT NULL DEFAULT '',tour_slug text,travel_date date NOT NULL,party_size integer NOT NULL CHECK(party_size BETWEEN 1 AND 100),message text NOT NULL,
 status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','awaiting_reply','confirmed','closed','spam')),
 delivery_status text NOT NULL DEFAULT 'sending' CHECK(delivery_status IN ('sending','sent','failed','unknown')),
 delivery_error text,delivery_attempt uuid,delivery_updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enquiries_inbox ON enquiries(created_at DESC,id);
CREATE INDEX IF NOT EXISTS enquiries_status ON enquiries(status,created_at DESC);
CREATE TABLE IF NOT EXISTS enquiry_activity (
 id uuid PRIMARY KEY,enquiry_id uuid NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
 actor text NOT NULL,kind text NOT NULL CHECK(kind IN ('created','status','note','delivery')),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 5000),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enquiry_activity_order ON enquiry_activity(enquiry_id,created_at DESC);
