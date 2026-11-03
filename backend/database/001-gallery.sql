CREATE TABLE IF NOT EXISTS gallery_admins (
  email text PRIMARY KEY CHECK (email = lower(email)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gallery_images (
  id uuid PRIMARY KEY,
  object_key text NOT NULL UNIQUE,
  caption text NOT NULL CHECK (char_length(caption) BETWEEN 1 AND 200),
  alt text NOT NULL CHECK (char_length(alt) BETWEEN 1 AND 300),
  category text NOT NULL CHECK (category IN ('landscape','wildlife','people','culture')),
  width integer NOT NULL CHECK (width > 0), height integer NOT NULL CHECK (height > 0),
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gallery_public_order ON gallery_images (sort_order, created_at DESC) WHERE published AND NOT archived;
