# automate-game-recaps

Creates one `game_recap` `feed_posts` row per game JSON in Storage, with rich sections built from `gameMetadata`, `score[gameId]`, `story`, and `AggregatedTeamStats`, plus links to `prop_results` and `player_spotlight` posts for the same `game_id`.

## Sections (order)

1. `hero`, `headline`
2. `pull_quote` (fun score, margin when present), `rich_text` (“At a glance”), `stat_comparison` (3PM, pace, fast break, TOV, eFG%), `chart` radar ×2 (away/home game shape), optional `chart` `metric_bar` (eFG%)
3. `video_carousel` (highlights from play-by-play MP4s)
4. `post_link` → latest prop results (if any)
5. Contiguous `post_link` → player spotlights (carousel in UI when 2+)

## Env

Same as other feed automations: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and Storage: `FEED_JSON_BUCKET` (default `game-data`), `FEED_JSON_PREFIX` (e.g. `feed` or empty).

## Invoke

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "$SUPABASE_URL/functions/v1/automate-game-recaps" \
  -d '{"date":"2026-03-23"}'
```

**Rebuild** an existing recap (delete sections + post, then insert fresh):

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "$SUPABASE_URL/functions/v1/automate-game-recaps" \
  -d '{"game_id":"0022501227","date":"2025-12-15","force":true}'
```

`force: true` removes the prior `game_recap:{game_id}` row and its sections before creating a new post.

## Metadata

`feed_posts.metadata.aggregated_team_stats` stores sanitized `{ away, home }` snapshots from `AggregatedTeamStats` for clients and OG use.
