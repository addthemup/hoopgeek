import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const feedDir = path.resolve(__dirname, 'scripts/feed')
const playByPlayDir = path.join(feedDir, 'play_by_play')
const playerStatsDir = path.join(feedDir, 'player_stats')
const shotChartsDir = path.join(feedDir, 'shot_charts')

/** True when root JSON already has box score / aggregated stats (monolithic scrape). */
function rootHasPlayerStats(json: any): boolean {
  if (Array.isArray(json.PlayerStats) && json.PlayerStats.length > 0) return true
  if (json.AggregatedPlayerStats && typeof json.AggregatedPlayerStats === 'object' && Object.keys(json.AggregatedPlayerStats).length > 0)
    return true
  if (json.playerStatsByPersonId && typeof json.playerStatsByPersonId === 'object' && Object.keys(json.playerStatsByPersonId).length > 0)
    return true
  return false
}

/** True when root JSON already has shot chart payload (monolithic uses shotChartData). */
function rootHasShotChartData(json: any): boolean {
  if (json.shotChartData && typeof json.shotChartData === 'object' && Object.keys(json.shotChartData).length > 0) return true
  if (json.shotCharts && typeof json.shotCharts === 'object' && Object.keys(json.shotCharts).length > 0) return true
  return false
}

/**
 * Merge player_stats/ and shot_charts/ only when the root file does not already include that data.
 * Avoids overwriting a complete `scripts/feed/{gameId}.json` with older split-folder fragments.
 */
function mergeSplitFolderFragmentsIfMissing(payload: any, gameId: string) {
  const playerStats = loadPlayerStatsForGame(gameId)
  const shotCharts = loadShotChartsForGame(gameId)
  if (!rootHasPlayerStats(payload) && playerStats) {
    if (playerStats.PlayerStats.length > 0) payload.PlayerStats = playerStats.PlayerStats
    if (Object.keys(playerStats.playerStatsByPersonId).length > 0) {
      payload.playerStatsByPersonId = playerStats.playerStatsByPersonId
    }
  }
  if (!rootHasShotChartData(payload) && shotCharts && Object.keys(shotCharts.shotChartData).length > 0) {
    payload.shotChartData = shotCharts.shotChartData
  }
  return payload
}

/** Normalize play_by_play "videos" array to playByPlay.allPlays shape for consumers. */
function normalizeVideosToPlayByPlay(videos: any[]): any[] {
  if (!Array.isArray(videos)) return []
  return videos.map((p: any) => ({
    personId: p.personId != null ? Number(p.personId) : null,
    playerName: p.playerName || p.playerNameI || null,
    teamTricode: p.teamTricode || null,
    actionType: p.actionType || '',
    subType: p.subType ?? null,
    description: p.description || '',
    mp4: p.mp4 || null,
    period: p.period || 0,
    clock: p.clock || '',
    shotResult: p.shotResult ?? null,
    isFieldGoal: p.isFieldGoal ?? 0,
    pointsTotal: p.pointsTotal ?? 0,
  }))
}

/** Load play_by_play JSON for a game; return { gameId, date, matchup, playByPlay } or null. */
function loadPlayByPlayForGame(gameId: string): { gameId: string; date: string; matchup: string; playByPlay: any[] } | null {
  const pbpPath = path.join(playByPlayDir, `play_by_play_${gameId}.json`)
  if (!fs.existsSync(pbpPath)) return null
  try {
    const raw = fs.readFileSync(pbpPath, 'utf-8')
    const data = JSON.parse(raw)
    const videos = data.videos ?? (data.playByPlay?.allPlays ?? data.playByPlay ?? [])
    const playByPlay = normalizeVideosToPlayByPlay(Array.isArray(videos) ? videos : [])
    return {
      gameId: data.gameId || gameId,
      date: data.date || '',
      matchup: data.matchup || '',
      playByPlay,
    }
  } catch {
    return null
  }
}

/** Load player_stats JSON for a game; return { PlayerStats, playerStatsByPersonId } or null. */
function loadPlayerStatsForGame(gameId: string): { PlayerStats: any[]; playerStatsByPersonId: Record<string, any> } | null {
  const statsPath = path.join(playerStatsDir, `player_stats_${gameId}.json`)
  if (!fs.existsSync(statsPath)) return null
  try {
    const raw = fs.readFileSync(statsPath, 'utf-8')
    const json = JSON.parse(raw)
    const PlayerStats = Array.isArray(json.PlayerStats) ? json.PlayerStats : []
    const playerStatsByPersonId: Record<string, any> = {}

    // Prefer AggregatedPlayerStats (has traditional_*, advanced_*, misc_*, etc.)
    if (json.AggregatedPlayerStats && typeof json.AggregatedPlayerStats === 'object') {
      for (const [personId, stats] of Object.entries(json.AggregatedPlayerStats)) {
        if (/^\d+$/.test(personId)) playerStatsByPersonId[personId] = stats
      }
    }

    // Merge in unified PlayerStats array so traditional stats are present when aggregated lacked them
    for (const row of PlayerStats) {
      const pid = row.personId ?? row.player_id
      if (pid == null) continue
      const key = String(pid)
      if (!playerStatsByPersonId[key]) playerStatsByPersonId[key] = {}
      const existing = playerStatsByPersonId[key]
      if (existing.traditional_points == null && (row.points ?? row.pts) != null) {
        existing.traditional_points = row.points ?? row.pts
        existing.traditional_reboundsTotal = row.reboundsTotal ?? row.reb
        existing.traditional_assists = row.assists ?? row.ast
        existing.traditional_steals = row.steals ?? row.stl
        existing.traditional_blocks = row.blocks ?? row.blk
        existing.traditional_turnovers = row.turnovers ?? row.tov
        existing.traditional_minutes = row.min ?? row.minutes
        existing.traditional_plusMinusPoints = row.plusMinusPoints ?? row.plus_minus
        existing.traditional_fieldGoalsMade = row.fieldGoalsMade ?? row.fgm
        existing.traditional_fieldGoalsAttempted = row.fieldGoalsAttempted ?? row.fga
        existing.traditional_threePointersMade = row.threePointersMade ?? row.fg3m
        existing.traditional_threePointersAttempted = row.threePointersAttempted ?? row.fg3a
        existing.traditional_freeThrowsMade = row.freeThrowsMade ?? row.ftm
        existing.traditional_freeThrowsAttempted = row.freeThrowsAttempted ?? row.fta
      }
    }

    // Legacy: top-level numeric keys (some feeds may have personId at root)
    for (const key of Object.keys(json)) {
      if (key !== 'gameId' && key !== 'PlayerStats' && key !== 'AggregatedPlayerStats' && key !== 'AggregatedTeamStats' && /^\d+$/.test(key)) {
        if (!playerStatsByPersonId[key]) playerStatsByPersonId[key] = json[key]
      }
    }

    return { PlayerStats, playerStatsByPersonId }
  } catch {
    return null
  }
}

/** Load shot_charts JSON for a game; return { shotChartData } or null. */
function loadShotChartsForGame(gameId: string): { shotChartData: Record<string, any[]> } | null {
  const chartsPath = path.join(shotChartsDir, `shot_charts_${gameId}.json`)
  if (!fs.existsSync(chartsPath)) return null
  try {
    const raw = fs.readFileSync(chartsPath, 'utf-8')
    const json = JSON.parse(raw)
    const shotChartData = json.shotChartData && typeof json.shotChartData === 'object' ? json.shotChartData : {}
    return { shotChartData }
  } catch {
    return null
  }
}

/**
 * Vite plugin that serves local feed JSON files during development.
 *
 *   GET /api/local-feed                     → list all game JSON filenames + sizes
 *   GET /api/local-feed/:id.json            → full game JSON (prefer scripts/feed/{id}.json; optional merge from split folders)
 *   GET /api/local-feed/play-by-play/:id.json → raw play_by_play file for game (legacy)
 *   GET /api/local-feed/by-date/:date       → games for date (root JSONs + legacy play_by_play/)
 *
 * Only active in dev mode. The scripts/feed/ directory is NOT bundled.
 */
function localFeedPlugin(): Plugin {
  return {
    name: 'local-feed-server',
    configureServer(server) {
      server.middlewares.use('/api/local-feed', (req, res, next) => {
        // Strip query string, normalize
        const url = (req.url ?? '').split('?')[0]

        // ── List endpoint: GET /api/local-feed ──
        if (url === '' || url === '/') {
          try {
            const files = fs.readdirSync(feedDir)
              .filter(f => f.endsWith('.json') && !f.startsWith('._'))
              .map(f => {
                const stat = fs.statSync(path.join(feedDir, f))
                return {
                  filename: f,
                  gameId: f.replace('.json', ''),
                  sizeBytes: stat.size,
                  modified: stat.mtime.toISOString(),
                }
              })
              .sort((a, b) => b.modified.localeCompare(a.modified))

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ count: files.length, files }))
          } catch (err: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        // ── Play-by-play only: GET /api/local-feed/play-by-play/0022500829.json ──
        const pbpMatch = url.match(/^\/play-by-play\/(\d{10})\.json$/)
        if (pbpMatch) {
          const out = loadPlayByPlayForGame(pbpMatch[1])
          if (out) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ gameId: out.gameId, date: out.date, matchup: out.matchup, playByPlay: { allPlays: out.playByPlay } }))
          } else {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'Play-by-play file not found' }))
          }
          return
        }

        // ── Date query: GET /api/local-feed/by-date/2026-02-08 ──
        // Scans root JSONs and play_by_play/ folder for games matching the date.
        const dateMatch = url.match(/^\/by-date\/(\d{4}-\d{2}-\d{2})$/)
        if (dateMatch) {
          const targetDate = dateMatch[1]
          try {
            const matches: any[] = []
            const seenGameIds = new Set<string>()

            // 1) Root feed JSONs (legacy monolithic)
            const rootFiles = fs.readdirSync(feedDir).filter(f => f.endsWith('.json') && /^\d{10}\.json$/.test(f) && !f.startsWith('._'))
            for (const f of rootFiles) {
              try {
                const raw = fs.readFileSync(path.join(feedDir, f), 'utf-8')
                const json = JSON.parse(raw)
                const meta = json.gameMetadata || {}
                const fileDate = (meta.date || '').split('T')[0]
                if (fileDate !== targetDate) continue

                const home = meta.homeTeam || {}
                const away = meta.awayTeam || {}
                if (!home.abbreviation && !away.abbreviation) continue

                const gameId = json.gameId || f.replace('.json', '')
                seenGameIds.add(gameId)
                const rawPbp = json.playByPlay?.allPlays || json.playByPlay || []
                const hasMp4 = Array.isArray(rawPbp) && rawPbp.some((p: any) => p && p.mp4)
                matches.push({
                  gameId,
                  filename: f,
                  date: fileDate,
                  homeTeam: home.abbreviation || null,
                  awayTeam: away.abbreviation || null,
                  homeScore: home.points ?? null,
                  awayScore: away.points ?? null,
                  playerCount: (json.PlayerStats || []).length,
                  hasStats: (json.PlayerStats || []).length > 0,
                  hasMp4: !!hasMp4,
                })
              } catch { /* skip */ }
            }

            // 2) play_by_play/ folder (separated PBP + MP4)
            if (fs.existsSync(playByPlayDir)) {
              const pbpFiles = fs.readdirSync(playByPlayDir).filter(f => f.endsWith('.json') && f.startsWith('play_by_play_') && !f.startsWith('._'))
              for (const f of pbpFiles) {
                const gameId = f.replace('play_by_play_', '').replace('.json', '')
                if (seenGameIds.has(gameId)) continue
                try {
                  const raw = fs.readFileSync(path.join(playByPlayDir, f), 'utf-8')
                  const data = JSON.parse(raw)
                  const fileDate = (data.date || '').split('T')[0]
                  if (fileDate !== targetDate) continue

                  const videos = data.videos ?? (data.playByPlay?.allPlays ?? data.playByPlay ?? [])
                  const hasMp4 = Array.isArray(videos) && videos.some((p: any) => p && p.mp4)
                  const teamTricodes = Array.isArray(videos)
                    ? [...new Set(videos.map((p: any) => p.teamTricode).filter(Boolean))]
                    : []
                  const homeTeam = teamTricodes[0] || null
                  const awayTeam = teamTricodes[1] || null
                  seenGameIds.add(gameId)
                  matches.push({
                    gameId,
                    filename: f,
                    date: fileDate,
                    homeTeam,
                    awayTeam,
                    homeScore: null,
                    awayScore: null,
                    playerCount: 0,
                    hasStats: false,
                    hasMp4: !!hasMp4,
                  })
                } catch { /* skip */ }
              }
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ date: targetDate, count: matches.length, games: matches }))
          } catch (err: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        // ── Single file: GET /api/local-feed/0022500376.json ──
        // Prefer one file: scripts/feed/{gameId}.json (metadata, score, PBP, PlayerStats, shotChartData).
        // If root has no MP4s, merge play_by_play/; if root lacks stats/charts, merge player_stats/ + shot_charts/.
        const match = url.match(/^\/(\d{10}\.json)$/)
        if (match) {
          const gameId = match[1].replace('.json', '')
          const filePath = path.join(feedDir, match[1])
          const pbp = loadPlayByPlayForGame(gameId)
          const playerStats = loadPlayerStatsForGame(gameId)

          if (fs.existsSync(filePath)) {
            try {
              const raw = fs.readFileSync(filePath, 'utf-8')
              const json = JSON.parse(raw)
              const rawPbp = json.playByPlay?.allPlays ?? json.playByPlay ?? []
              const hasMp4 = Array.isArray(rawPbp) && rawPbp.some((p: any) => p && p.mp4)
              // If root has no MP4 plays but we have play_by_play, merge in playByPlay from folder
              if (!hasMp4 && pbp && pbp.playByPlay.length > 0) {
                json.playByPlay = { allPlays: pbp.playByPlay }
              }
              mergeSplitFolderFragmentsIfMissing(json, gameId)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(json))
            } catch (err: any) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
            }
            return
          }

          if (pbp && pbp.playByPlay.length > 0) {
            // No root file; build minimal game JSON from play_by_play for TOTW/highlights
            const teamTricodes = [...new Set(pbp.playByPlay.map((p: any) => p.teamTricode).filter(Boolean))]
            const homeAbbr = teamTricodes[0] || ''
            const awayAbbr = teamTricodes[1] || teamTricodes[0] || ''
            const payload = mergeSplitFolderFragmentsIfMissing(
              {
                gameId: pbp.gameId,
                gameMetadata: {
                  date: pbp.date,
                  homeTeam: { abbreviation: homeAbbr },
                  awayTeam: { abbreviation: awayAbbr },
                },
                playByPlay: { allPlays: pbp.playByPlay },
                PlayerStats: playerStats?.PlayerStats ?? [],
              },
              gameId,
            )
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(payload))
            return
          }

          res.statusCode = 404
          res.end(JSON.stringify({ error: 'File not found' }))
          return
        }

        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), localFeedPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // In dev, proxy NBA stats so the request runs from your machine (avoids edge timeout).
      '/api/nba': {
        target: 'https://stats.nba.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nba/, '/stats'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Referer', 'https://stats.nba.com/')
            proxyReq.setHeader('Origin', 'https://stats.nba.com')
            proxyReq.setHeader('x-nba-stats-origin', 'stats')
            proxyReq.setHeader('x-nba-stats-token', 'true')
          })
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  build: {
    chunkSizeWarningLimit: 10000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/joy', '@mui/icons-material'],
        },
      },
    },
  },
})
