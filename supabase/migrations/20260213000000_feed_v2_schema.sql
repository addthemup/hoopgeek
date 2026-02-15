-- =====================================================================
-- FEED V2 SCHEMA — Complete rebuild
-- Migration: 20260213000000_feed_v2_schema.sql
--
-- WHAT THIS DOES:
--   1. Drops the old feed tables (feed_posts, feed_content,
--      feed_likes, feed_comments, feed_shares, user_post_views)
--   2. Creates a new section-based feed system where each post
--      is a scrollable "news story" with typed content sections
--   3. Adds proper social tables (comments w/ threading, likes,
--      shares, bookmarks, views)
--
-- POST TYPES SUPPORTED:
--   game_recap        — Fun-score game breakdown (replaces old fun_score)
--   player_spotlight  — Individual player highlight story
--   team_of_night     — nba_totn award post (5 starters + bench)
--   team_of_week      — nba_totw award post (weekly best)
--   player_of_week    — Weekly standout player
--   player_of_month   — Monthly standout player
--   prop_prediction   — Pre-game prop picks (theoretical for now)
--   prop_results      — Post-game prop results
--   injury_report     — Injury news roundup (theoretical for now)
--
-- SECTION TYPES (content blocks inside each post):
--   hero              — Cover image / title card
--   headline          — Text headline + subtitle
--   lineup_card       — Team lineup display (for TOTN/TOTW)
--   player_highlight  — Player stat card + video clip
--   stat_comparison   — Side-by-side team/player stat bars
--   video_clip        — Embedded video with overlay
--   chart             — Any chart component (shot chart, radar, etc.)
--   rich_text         — Markdown/HTML narrative block
--   prop_card         — Prop bet card (line, result, trend)
--   injury_card       — Player injury status card
--   pull_quote        — Highlighted stat or quote callout
--   gallery           — Multi-image carousel
--   box_score         — Compact box score table
-- =====================================================================

-- ========================
-- 1. DROP OLD TABLES
-- ========================

-- Drop engagement tables first (they FK to feed_posts / feed_content)
DROP TABLE IF EXISTS feed_likes CASCADE;
DROP TABLE IF EXISTS feed_comments CASCADE;
DROP TABLE IF EXISTS feed_shares CASCADE;
DROP TABLE IF EXISTS user_post_views CASCADE;

-- Drop the old content + posts tables
DROP TABLE IF EXISTS feed_content CASCADE;
DROP TABLE IF EXISTS feed_posts CASCADE;


-- ========================
-- 2. CORE: feed_posts
-- ========================
-- One row = one "story". Each story opens its own page at /feed/:slug
-- The feed card is rendered from title, subtitle, cover_image_url, post_type
-- Clicking through renders the full section list.

CREATE TABLE feed_posts (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Type & status
    post_type     TEXT NOT NULL
                  CHECK (post_type IN (
                      'game_recap',
                      'player_spotlight',
                      'team_of_night',
                      'team_of_week',
                      'player_of_week',
                      'player_of_month',
                      'prop_prediction',
                      'prop_results',
                      'injury_report'
                  )),
    status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'archived')),

    -- Deduplication key  e.g. 'game_recap:0022500403', 'totn:2026-02-10'
    source_ref    TEXT UNIQUE,

    -- Display fields (used on feed cards)
    title         TEXT NOT NULL,
    subtitle      TEXT,                    -- secondary headline
    description   TEXT,                    -- short blurb for previews
    slug          TEXT UNIQUE NOT NULL,    -- URL-safe: /feed/:slug

    -- Media
    cover_image_url  TEXT,                 -- hero / card thumbnail
    share_image_url  TEXT,                 -- OG image for social sharing

    -- NBA context (nullable — not every post type needs all of these)
    game_id       TEXT,                    -- NBA game ID (e.g. '0022500403')
    game_date     DATE,                    -- primary date of the post
    team_tricodes TEXT[],                  -- teams involved  ['BOS','IND']
    player_ids    BIGINT[],               -- all NBA person IDs involved
    person_id     BIGINT,                 -- primary player (spotlights, awards)

    -- Flexible per-type payload (story_data, fun_data, etc.)
    metadata      JSONB DEFAULT '{}'::jsonb,

    -- Filtering / discovery
    tags          TEXT[] DEFAULT '{}',     -- e.g. ['highlights','awards','props']

    -- Engagement counters (denormalized for fast reads)
    likes_count    INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    shares_count   INTEGER NOT NULL DEFAULT 0,
    views_count    INTEGER NOT NULL DEFAULT 0,
    bookmarks_count INTEGER NOT NULL DEFAULT 0,

    -- Authorship
    created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name   TEXT DEFAULT 'HoopGeek',

    -- Timestamps
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_feed_posts_post_type     ON feed_posts(post_type);
CREATE INDEX idx_feed_posts_status        ON feed_posts(status);
CREATE INDEX idx_feed_posts_game_date     ON feed_posts(game_date DESC);
CREATE INDEX idx_feed_posts_published_at  ON feed_posts(published_at DESC);
CREATE INDEX idx_feed_posts_slug          ON feed_posts(slug);
CREATE INDEX idx_feed_posts_game_id       ON feed_posts(game_id);
CREATE INDEX idx_feed_posts_person_id     ON feed_posts(person_id);
CREATE INDEX idx_feed_posts_tags          ON feed_posts USING GIN(tags);
CREATE INDEX idx_feed_posts_team_tricodes ON feed_posts USING GIN(team_tricodes);
CREATE INDEX idx_feed_posts_player_ids    ON feed_posts USING GIN(player_ids);

COMMENT ON TABLE  feed_posts IS 'Feed v2 — each row is a scrollable news story';
COMMENT ON COLUMN feed_posts.source_ref IS 'Dedup key e.g. game_recap:0022500403 or totn:2026-02-10';
COMMENT ON COLUMN feed_posts.slug IS 'URL-safe identifier for /feed/:slug route';
COMMENT ON COLUMN feed_posts.metadata IS 'Flexible JSONB payload — story_data, fun_data, award context, etc.';


-- ========================
-- 3. SECTIONS: feed_post_sections
-- ========================
-- Ordered content blocks that compose the full story page.
-- Each section has a typed layout (hero, player_highlight, chart, etc.)
-- and a JSONB `content` field whose shape varies by section_type.

CREATE TABLE feed_post_sections (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id        UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,

    section_order  INTEGER NOT NULL DEFAULT 0,
    section_type   TEXT NOT NULL
                   CHECK (section_type IN (
                       'hero',
                       'headline',
                       'lineup_card',
                       'player_highlight',
                       'stat_comparison',
                       'video_clip',
                       'chart',
                       'rich_text',
                       'prop_card',
                       'injury_card',
                       'pull_quote',
                       'gallery',
                       'box_score'
                   )),

    -- Optional heading for this section
    title          TEXT,

    -- Flexible content payload (varies by section_type — see docs below)
    content        JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Optional NBA context scoped to this section
    player_id      BIGINT,               -- player this section is about
    team_tricode   TEXT,                  -- team this section is about

    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feed_sections_post_id ON feed_post_sections(post_id, section_order);
CREATE INDEX idx_feed_sections_type    ON feed_post_sections(section_type);
CREATE INDEX idx_feed_sections_player  ON feed_post_sections(player_id);

COMMENT ON TABLE  feed_post_sections IS 'Ordered content blocks inside a feed story';
COMMENT ON COLUMN feed_post_sections.content IS 'JSONB payload — shape depends on section_type';


-- ========================
-- 4. SOCIAL: feed_post_comments
-- ========================
-- Threaded comments. parent_comment_id = NULL for top-level.

CREATE TABLE feed_post_comments (
    id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id            UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_comment_id  UUID REFERENCES feed_post_comments(id) ON DELETE CASCADE,

    content            TEXT NOT NULL CHECK (char_length(content) > 0),
    likes_count        INTEGER NOT NULL DEFAULT 0,
    is_edited          BOOLEAN NOT NULL DEFAULT FALSE,

    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feed_comments_post_id ON feed_post_comments(post_id, created_at);
CREATE INDEX idx_feed_comments_user_id ON feed_post_comments(user_id);
CREATE INDEX idx_feed_comments_parent  ON feed_post_comments(parent_comment_id);

COMMENT ON TABLE feed_post_comments IS 'Threaded comments on feed stories';


-- ========================
-- 5. SOCIAL: feed_post_likes
-- ========================

CREATE TABLE feed_post_likes (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id     UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (post_id, user_id)
);

CREATE INDEX idx_feed_likes_post_id ON feed_post_likes(post_id);
CREATE INDEX idx_feed_likes_user_id ON feed_post_likes(user_id);

COMMENT ON TABLE feed_post_likes IS 'One like per user per post';


-- ========================
-- 6. SOCIAL: feed_post_shares
-- ========================

CREATE TABLE feed_post_shares (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id     UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- nullable for anonymous
    platform    TEXT NOT NULL CHECK (platform IN ('twitter', 'facebook', 'copy', 'instagram', 'sms', 'other')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feed_shares_post_id ON feed_post_shares(post_id);

COMMENT ON TABLE feed_post_shares IS 'Share events per post';


-- ========================
-- 7. SOCIAL: feed_post_bookmarks
-- ========================

CREATE TABLE feed_post_bookmarks (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id     UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (post_id, user_id)
);

CREATE INDEX idx_feed_bookmarks_user ON feed_post_bookmarks(user_id, created_at DESC);

COMMENT ON TABLE feed_post_bookmarks IS 'Saved / bookmarked posts per user';


-- ========================
-- 8. ANALYTICS: feed_post_views
-- ========================

CREATE TABLE feed_post_views (
    id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id               UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    user_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- nullable for anonymous
    viewed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    view_duration_seconds INTEGER,          -- how long they spent on the story
    sections_viewed       INTEGER DEFAULT 0, -- how many sections they scrolled through
    source                TEXT               -- 'feed', 'share_link', 'push_notification', etc.
);

CREATE INDEX idx_feed_views_post_id ON feed_post_views(post_id);
CREATE INDEX idx_feed_views_user    ON feed_post_views(user_id, viewed_at DESC);

COMMENT ON TABLE  feed_post_views IS 'View tracking per post (supports anonymous)';
COMMENT ON COLUMN feed_post_views.sections_viewed IS 'How many sections the user scrolled through';


-- ========================
-- 9. COMMENT LIKES (optional granularity)
-- ========================

CREATE TABLE feed_comment_likes (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id  UUID NOT NULL REFERENCES feed_post_comments(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (comment_id, user_id)
);

CREATE INDEX idx_comment_likes_comment ON feed_comment_likes(comment_id);

COMMENT ON TABLE feed_comment_likes IS 'One like per user per comment';


-- ========================
-- 10. AUTO-UPDATE updated_at TRIGGER
-- ========================

CREATE OR REPLACE FUNCTION update_feed_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_feed_posts_updated_at
    BEFORE UPDATE ON feed_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_feed_updated_at();

CREATE TRIGGER trg_feed_comments_updated_at
    BEFORE UPDATE ON feed_post_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_feed_updated_at();


-- ========================
-- 11. ENGAGEMENT COUNTER TRIGGERS
-- ========================
-- Automatically keep denormalized counts in sync.

-- Likes count
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE feed_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE feed_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_feed_likes_count
    AFTER INSERT OR DELETE ON feed_post_likes
    FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

-- Comments count
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE feed_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE feed_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_feed_comments_count
    AFTER INSERT OR DELETE ON feed_post_comments
    FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- Shares count
CREATE OR REPLACE FUNCTION update_post_shares_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE feed_posts SET shares_count = shares_count + 1 WHERE id = NEW.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_feed_shares_count
    AFTER INSERT ON feed_post_shares
    FOR EACH ROW EXECUTE FUNCTION update_post_shares_count();

-- Bookmarks count
CREATE OR REPLACE FUNCTION update_post_bookmarks_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE feed_posts SET bookmarks_count = bookmarks_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE feed_posts SET bookmarks_count = GREATEST(bookmarks_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_feed_bookmarks_count
    AFTER INSERT OR DELETE ON feed_post_bookmarks
    FOR EACH ROW EXECUTE FUNCTION update_post_bookmarks_count();

-- Views count
CREATE OR REPLACE FUNCTION update_post_views_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE feed_posts SET views_count = views_count + 1 WHERE id = NEW.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_feed_views_count
    AFTER INSERT ON feed_post_views
    FOR EACH ROW EXECUTE FUNCTION update_post_views_count();

-- Comment likes count
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE feed_post_comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE feed_post_comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.comment_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comment_likes_count
    AFTER INSERT OR DELETE ON feed_comment_likes
    FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();


-- ========================
-- 12. ROW LEVEL SECURITY
-- ========================

-- feed_posts: anyone can read published, only service_role can write
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published feed posts"
    ON feed_posts FOR SELECT
    USING (status = 'published');

CREATE POLICY "Authenticated users can read all feed posts"
    ON feed_posts FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Service role manages feed posts"
    ON feed_posts FOR ALL TO service_role
    USING (true);

-- feed_post_sections: readable if parent post is readable
ALTER TABLE feed_post_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sections of published posts"
    ON feed_post_sections FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM feed_posts WHERE id = post_id AND status = 'published'
    ));

CREATE POLICY "Service role manages sections"
    ON feed_post_sections FOR ALL TO service_role
    USING (true);

-- feed_post_comments: anyone can read, authenticated can insert their own
ALTER TABLE feed_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments"
    ON feed_post_comments FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create comments"
    ON feed_post_comments FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
    ON feed_post_comments FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
    ON feed_post_comments FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role manages comments"
    ON feed_post_comments FOR ALL TO service_role
    USING (true);

-- feed_post_likes: authenticated users manage their own
ALTER TABLE feed_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes"
    ON feed_post_likes FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can like"
    ON feed_post_likes FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike (delete own)"
    ON feed_post_likes FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role manages likes"
    ON feed_post_likes FOR ALL TO service_role
    USING (true);

-- feed_post_shares
ALTER TABLE feed_post_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shares"
    ON feed_post_shares FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can share"
    ON feed_post_shares FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role manages shares"
    ON feed_post_shares FOR ALL TO service_role
    USING (true);

-- feed_post_bookmarks
ALTER TABLE feed_post_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bookmarks"
    ON feed_post_bookmarks FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create bookmarks"
    ON feed_post_bookmarks FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
    ON feed_post_bookmarks FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role manages bookmarks"
    ON feed_post_bookmarks FOR ALL TO service_role
    USING (true);

-- feed_post_views
ALTER TABLE feed_post_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own views"
    ON feed_post_views FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Anyone can insert views"
    ON feed_post_views FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role manages views"
    ON feed_post_views FOR ALL TO service_role
    USING (true);

-- feed_comment_likes
ALTER TABLE feed_comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comment likes"
    ON feed_comment_likes FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can like comments"
    ON feed_comment_likes FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike comments"
    ON feed_comment_likes FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role manages comment likes"
    ON feed_comment_likes FOR ALL TO service_role
    USING (true);


-- ========================
-- 13. HELPER: slug generator
-- ========================
-- Generates a URL-safe slug from title + date + random suffix

CREATE OR REPLACE FUNCTION generate_feed_slug(p_title TEXT, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    suffix TEXT;
BEGIN
    -- Lowercase, replace non-alphanum with hyphens, collapse multiples, trim
    base_slug := lower(p_title);
    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(both '-' from base_slug);

    -- Truncate to 60 chars
    base_slug := left(base_slug, 60);
    base_slug := trim(both '-' from base_slug);

    -- Append date
    base_slug := base_slug || '-' || to_char(p_date, 'YYYY-MM-DD');

    -- Add 4-char random suffix for uniqueness
    suffix := substr(md5(random()::text), 1, 4);
    final_slug := base_slug || '-' || suffix;

    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_feed_slug IS 'Generates URL-safe slug: title-YYYY-MM-DD-xxxx';


-- =====================================================================
-- SECTION CONTENT SHAPES (documentation — not enforced in SQL)
-- =====================================================================
--
-- hero:
--   { "image_url": "...", "gradient_overlay": true, "badge": "TEAM OF THE NIGHT" }
--
-- headline:
--   { "text": "...", "subtitle": "...", "accent_color": "#FFC72C" }
--
-- lineup_card:
--   { "starters": [...], "bench": [...], "total_salary": 180000000,
--     "total_fantasy_points": 342.5, "salary_cap": 208000000 }
--   Each player: { "player_id": 203999, "name": "Nikola Jokić",
--     "fantasy_points": 68.2, "salary": 51000000, "position": "C",
--     "team_tricode": "DEN", "headshot_url": "..." }
--
-- player_highlight:
--   { "player_id": 203999, "name": "...", "headshot_url": "...",
--     "team_tricode": "DEN", "stats": { "pts": 32, "reb": 14, "ast": 9 },
--     "fantasy_points": 68.2, "video_url": "...", "video_thumbnail": "...",
--     "data_overlays": [ { "label": "PTS", "value": "32", "color": "#FFC72C" } ] }
--
-- stat_comparison:
--   { "title": "Points in Paint", "teams": [
--       { "tricode": "BOS", "value": 52, "color": "#007A33" },
--       { "tricode": "IND", "value": 28, "color": "#002D62" }
--   ], "diff": 24 }
--
-- video_clip:
--   { "video_url": "...", "thumbnail_url": "...", "caption": "...",
--     "duration_seconds": 15, "action_type": "Dunk", "period": 3, "clock": "4:22" }
--
-- chart:
--   { "chart_type": "shot_chart|radar|efficiency|rim_pressure|...",
--     "chart_props": { ... }, "caption": "..." }
--
-- rich_text:
--   { "markdown": "## Key Takeaway\nBoston dominated the paint..." }
--
-- prop_card:
--   { "player_id": 203999, "player_name": "...", "bet_type": "points",
--     "line": 26.5, "actual": 32, "result": "over", "odds": -110,
--     "confidence": 0.78, "trend": [24, 28, 31, 19, 32] }
--
-- injury_card:
--   { "player_id": 203999, "player_name": "...", "team_tricode": "BOS",
--     "status": "OUT", "injury": "Left knee soreness",
--     "expected_return": "2026-02-20", "impact_note": "..." }
--
-- pull_quote:
--   { "text": "52 points in the paint", "attribution": "Game Stat",
--     "accent_color": "#FFC72C", "icon": "fire" }
--
-- gallery:
--   { "images": [ { "url": "...", "caption": "..." } ] }
--
-- box_score:
--   { "home": { "tricode": "BOS", "players": [...] },
--     "away": { "tricode": "IND", "players": [...] } }
-- =====================================================================
