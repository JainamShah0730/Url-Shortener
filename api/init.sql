CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS urls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    short_code VARCHAR(30) UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    title VARCHAR(255),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    click_limit INTEGER
);

CREATE TABLE IF NOT EXISTS analytics (
    id BIGSERIAL PRIMARY KEY,
    url_id UUID NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    ip_hash VARCHAR(64),
    user_agent TEXT,
    referer TEXT
);

CREATE INDEX IF NOT EXISTS idx_urls_short_code ON urls(short_code);
CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_url_id ON analytics(url_id);
CREATE INDEX IF NOT EXISTS idx_analytics_clicked_at ON analytics(clicked_at DESC);

CREATE OR REPLACE VIEW url_stats AS
SELECT
    u.id,
    u.short_code,
    u.original_url,
    u.title,
    u.user_id,
    u.created_at,
    u.expires_at,
    u.is_active,
    u.click_limit,
    COUNT(a.id) AS total_clicks,
    MAX(a.clicked_at) AS last_clicked_at
FROM urls u
LEFT JOIN analytics a ON a.url_id = u.id
GROUP BY u.id;
