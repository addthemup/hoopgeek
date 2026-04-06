import { Box, Typography } from '@mui/joy'
import type { SxProps } from '@mui/joy/styles/types'
import type { ComponentProps } from 'react'
import type { FeedPost } from '../../types/feed'
import { getFinalScoreLineFromPost } from '../../utils/feedPostMetadata'
import { getTeamLogoUrl } from '../../utils/nbaTeamLogos'

const scoreLineSx = {
  display: 'block',
  mt: 0.75,
  fontSize: '0.82em',
  fontWeight: 600,
  opacity: 0.88,
  letterSpacing: '0.01em',
  lineHeight: 1.35,
} as const

/**
 * Renders feed titles like "Player — Warriors vs Mavericks" as
 * "Player — [logo] vs [logo]" when `post.team_tricodes` has two entries.
 * Optional second line: `metadata.story.final_score` when present.
 */
export function PostStoryTitleWithTeamLogos({
  post,
  level = 'h4',
  sx,
  logoSize = 36,
}: {
  post: FeedPost
  level?: ComponentProps<typeof Typography>['level']
  sx?: SxProps
  logoSize?: number
}) {
  const scoreLine = getFinalScoreLineFromPost(post)
  const tri = (post.team_tricodes ?? []).filter(Boolean)
  const raw = post.title?.trim() ?? ''
  const parts = raw.split(/\s*[—–-]\s+/)
  const canUseLogos = tri.length >= 2 && parts.length >= 2
  const playerPart = canUseLogos ? parts[0].trim() : raw

  if (!canUseLogos) {
    return (
      <Box sx={{ minWidth: 0 }}>
        <Typography level={level} sx={sx}>
          {raw}
        </Typography>
        {scoreLine && (
          <Typography level="body-xs" component="div" sx={{ ...scoreLineSx, color: 'inherit' }}>
            {scoreLine}
          </Typography>
        )}
      </Box>
    )
  }

  const [a, b] = tri as [string, string]

  return (
    <Typography level={level} component="div" sx={sx}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          columnGap: 1,
          rowGap: 0.5,
        }}
      >
        <Box component="span" sx={{ fontWeight: 'inherit', fontFamily: 'inherit' }}>
          {playerPart}
        </Box>
        <Box component="span" sx={{ opacity: 0.85, fontWeight: 600, userSelect: 'none' }} aria-hidden>
          —
        </Box>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            flexShrink: 0,
          }}
          aria-label={`${a} vs ${b}`}
        >
          <Box
            component="img"
            src={getTeamLogoUrl(a)}
            alt=""
            sx={{ width: logoSize, height: logoSize, objectFit: 'contain' }}
          />
          <Box
            component="span"
            sx={{
              opacity: 0.9,
              fontSize: '0.85em',
              fontWeight: 600,
              textTransform: 'lowercase',
              userSelect: 'none',
            }}
          >
            vs
          </Box>
          <Box
            component="img"
            src={getTeamLogoUrl(b)}
            alt=""
            sx={{ width: logoSize, height: logoSize, objectFit: 'contain' }}
          />
        </Box>
      </Box>
      {scoreLine && (
        <Typography level="body-xs" component="div" sx={{ ...scoreLineSx, color: 'inherit', mt: 1 }}>
          {scoreLine}
        </Typography>
      )}
    </Typography>
  )
}
