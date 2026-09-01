CREATE TABLE IF NOT EXISTS enquiries (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(254) NOT NULL,
  plan VARCHAR(180) NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  follow_up_1 TEXT NOT NULL DEFAULT '',
  follow_up_2 TEXT NOT NULL DEFAULT '',
  follow_up_3 TEXT NOT NULL DEFAULT '',
  admin_notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS news_posts (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category VARCHAR(20) NOT NULL CHECK (category IN ('youtube', 'instagram', 'news')),
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS enquiries_created_at_idx ON enquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS news_posts_category_created_at_idx ON news_posts (category, created_at DESC);