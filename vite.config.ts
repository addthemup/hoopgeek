import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

/**
 * Vite plugin that serves local feed JSON files during development.
 *
 *   GET /api/local-feed                → list all game JSON filenames + sizes
 *   GET /api/local-feed/:id.json       → return the full game JSON
 *   GET /api/local-feed/by-date/:date  → return all game JSONs whose gameMetadata.date matches
 *
 * Only active in dev mode. The scripts/feed/ directory is NOT bundled.
 */
function localFeedPlugin(): Plugin {
  const feedDir = path.resolve(__dirname, 'scripts/feed')

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

        // ── Date query: GET /api/local-feed/by-date/2026-02-08 ──
        // Scans all JSONs, returns lightweight summaries for files matching the date.
        const dateMatch = url.match(/^\/by-date\/(\d{4}-\d{2}-\d{2})$/)
        if (dateMatch) {
          const targetDate = dateMatch[1]
          try {
            const allFiles = fs.readdirSync(feedDir)
              .filter(f => f.endsWith('.json') && !f.startsWith('._'))

            const matches: any[] = []
            for (const f of allFiles) {
              try {
                const raw = fs.readFileSync(path.join(feedDir, f), 'utf-8')
                const json = JSON.parse(raw)
                const meta = json.gameMetadata || {}
                const fileDate = (meta.date || '').split('T')[0]
                if (fileDate !== targetDate) continue

                const home = meta.homeTeam || {}
                const away = meta.awayTeam || {}
                // Skip empty/unplayed shells
                if (!home.abbreviation && !away.abbreviation) continue

                const playerCount = (json.PlayerStats || []).length
                matches.push({
                  gameId: json.gameId || f.replace('.json', ''),
                  filename: f,
                  date: fileDate,
                  homeTeam: home.abbreviation || null,
                  awayTeam: away.abbreviation || null,
                  homeScore: home.points ?? null,
                  awayScore: away.points ?? null,
                  playerCount,
                  hasStats: playerCount > 0,
                })
              } catch { /* skip malformed */ }
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
        const match = url.match(/^\/(\d{10}\.json)$/)
        if (match) {
          const filePath = path.join(feedDir, match[1])
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/json')
            const stream = fs.createReadStream(filePath)
            stream.pipe(res)
          } else {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'File not found' }))
          }
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
