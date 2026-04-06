/**
 * Feed post_link sections: Glimpse hover preview (desktop) + grouped Player Spotlight carousel.
 */

import { useNavigate } from 'react-router-dom'
import { useMediaQuery } from '@mui/material'
import { Box, Typography, Card, CardContent, Chip, Stack } from '@mui/joy'
import type { FeedPostSection, PostLinkContent } from '../../types/feed'
import {
  Glimpse,
  GlimpseTrigger,
  GlimpseContent,
  GlimpseTitle,
  GlimpseDescription,
  GlimpseImage,
} from '@/components/kibo-ui/glimpse'
import { AvatarStack } from '@/components/kibo-ui/avatar-stack'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Stories, StoriesContent, Story } from '@/components/kibo-ui/stories'
import { cn } from '@/lib/utils'

const TYPE_COLORS: Record<string, string> = {
  game_recap: '#FFC72C',
  player_spotlight: '#60A5FA',
  team_of_night: '#F59E0B',
  team_of_week: '#A78BFA',
  player_of_week: '#34D399',
  player_of_month: '#F472B6',
  prop_prediction: '#FB923C',
  prop_results: '#10B981',
  injury_report: '#EF4444',
  upcoming: '#8B5CF6',
  blog: '#0EA5E9',
  draft: '#6366F1',
  dfs: '#22C55E',
}

function postLinkMeta(content: PostLinkContent) {
  const color = TYPE_COLORS[content.post_type] || '#FFC72C'
  const typeLabel = content.post_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return { color, typeLabel }
}

function previewBody(content: PostLinkContent): string | undefined {
  const t = content.preview_text?.trim() || content.subtitle?.trim()
  return t || undefined
}

/** Single related-post row with optional Glimpse on desktop. */
export function PostLinkSection({ content }: { content: PostLinkContent }) {
  const navigate = useNavigate()
  const enableGlimpse = useMediaQuery('(min-width: 900px)')
  const { color, typeLabel } = postLinkMeta(content)
  const go = () => navigate(`/feed/${content.slug}`)

  const inner = (
    <Card
      variant="outlined"
      sx={{
        bgcolor: '#0a0a0a',
        borderColor: `${color}44`,
        borderLeft: `3px solid ${color}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
        '&:hover': { borderColor: color, transform: 'translateX(4px)', bgcolor: '#111' },
      }}
    >
      <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {content.cover_image_url && (
          <Box
            component="img"
            src={content.cover_image_url}
            alt=""
            sx={{ width: 72, height: 48, borderRadius: 'sm', objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {content.context && (
            <Typography level="body-xs" sx={{ color: '#888', mb: 0.5, fontStyle: 'italic' }}>
              {content.context}
            </Typography>
          )}
          <Stack direction="row" gap={0.5} alignItems="center" sx={{ mb: 0.5 }}>
            <Chip size="sm" sx={{ bgcolor: `${color}22`, color, fontWeight: 700, fontSize: '0.6rem' }}>
              {typeLabel}
            </Chip>
            {content.team_tricodes?.map((t) => (
              <Chip key={t} size="sm" variant="outlined" sx={{ fontSize: '0.6rem' }}>
                {t}
              </Chip>
            ))}
          </Stack>
          <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 600 }} noWrap>
            {content.title}
          </Typography>
          {content.subtitle && (
            <Typography level="body-xs" sx={{ color: '#AAA' }} noWrap>
              {content.subtitle}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )

  if (!enableGlimpse) {
    return (
      <Box onClick={go} sx={{ width: '100%' }} role="link" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go())}>
        {inner}
      </Box>
    )
  }

  return (
    <Glimpse>
      <GlimpseTrigger asChild>
        <Box
          component="div"
          sx={{ width: '100%', cursor: 'pointer' }}
          onClick={go}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              go()
            }
          }}
          tabIndex={0}
          role="link"
          aria-label={`Open story: ${content.title}`}
        >
          <Box sx={{ pointerEvents: 'none' }}>{inner}</Box>
        </Box>
      </GlimpseTrigger>
      <GlimpseContent side="top" align="start" className="border-neutral-800 bg-neutral-950">
        {content.cover_image_url ? (
          <GlimpseImage src={content.cover_image_url} alt="" />
        ) : (
          <Box
            sx={{
              aspectRatio: '16/9',
              width: '100%',
              bgcolor: 'neutral.900',
              background: `linear-gradient(135deg, ${color}33 0%, #111 100%)`,
            }}
          />
        )}
        {content.context && (
          <p className="px-3 pt-3 text-xs italic text-neutral-500">{content.context}</p>
        )}
        <GlimpseTitle>{content.title}</GlimpseTitle>
        {(() => {
          const body = previewBody(content)
          return body ? <GlimpseDescription>{body}</GlimpseDescription> : null
        })()}
        <p className="px-3 pb-3 text-xs font-semibold text-amber-400/90">View full story →</p>
      </GlimpseContent>
    </Glimpse>
  )
}

/** Horizontal Stories carousel + avatar stack for consecutive Player Spotlight post_links. */
export function PostLinkSpotlightCarousel({ sections }: { sections: FeedPostSection[] }) {
  const navigate = useNavigate()
  const links = sections.map((s) => s.content as PostLinkContent)

  return (
    <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#333', overflow: 'hidden', mb: 2 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography level="title-sm" sx={{ color: '#FFF', fontWeight: 700 }}>
            Player spotlights
          </Typography>
          <AvatarStack animate size={36} className="max-w-full justify-end">
            {links.slice(0, 8).map((c) => (
              <Avatar key={c.slug} className="ring-2 ring-neutral-900">
                {c.cover_image_url ? (
                  <AvatarImage src={c.cover_image_url} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-neutral-800 text-[10px] text-neutral-300">
                  {(c.title || '?').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            ))}
          </AvatarStack>
        </Box>
        <Stories className="w-full" opts={{ align: 'start', loop: false, dragFree: true }}>
          <StoriesContent className="-ml-1 gap-3">
            {links.map((c) => {
              const { color, typeLabel } = postLinkMeta(c)
              return (
                <Story
                  key={c.slug}
                  className={cn('basis-[200px] pl-1 md:basis-[240px]', 'bg-neutral-900/80 border border-neutral-800')}
                  onClick={() => navigate(`/feed/${c.slug}`)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), navigate(`/feed/${c.slug}`))}
                >
                  <Box className="relative flex h-full min-h-[200px] flex-col overflow-hidden rounded-xl">
                    {c.cover_image_url ? (
                      <Box
                        component="img"
                        src={c.cover_image_url}
                        alt=""
                        className="h-28 w-full object-cover"
                      />
                    ) : (
                      <Box
                        sx={{
                          height: 112,
                          width: '100%',
                          background: `linear-gradient(135deg, ${color}44 0%, #111 100%)`,
                        }}
                      />
                    )}
                    <Box sx={{ p: 1.5, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Chip size="sm" sx={{ alignSelf: 'flex-start', bgcolor: `${color}22`, color, fontSize: '0.6rem', fontWeight: 700 }}>
                        {typeLabel}
                      </Chip>
                      <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 600, lineHeight: 1.3 }} className="line-clamp-2">
                        {c.title}
                      </Typography>
                      {(c.subtitle || c.preview_text) && (
                        <Typography level="body-xs" sx={{ color: '#888' }} className="line-clamp-2">
                          {c.preview_text || c.subtitle}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Story>
              )
            })}
          </StoriesContent>
        </Stories>
      </CardContent>
    </Card>
  )
}

export const SPOTLIGHT_CONTEXT = 'Player Spotlight'

export function isPlayerSpotlightPostLink(section: FeedPostSection): boolean {
  if (section.section_type !== 'post_link') return false
  const c = section.content as PostLinkContent
  return c.context === SPOTLIGHT_CONTEXT
}

/** Indices to skip when rendering flat list (middle items of a spotlight group). */
export function buildSpotlightSkipSet(displaySections: FeedPostSection[]): Set<number> {
  const skip = new Set<number>()
  let i = 0
  while (i < displaySections.length) {
    if (isPlayerSpotlightPostLink(displaySections[i])) {
      let j = i + 1
      while (j < displaySections.length && isPlayerSpotlightPostLink(displaySections[j])) j++
      const len = j - i
      if (len >= 2) {
        for (let k = i + 1; k < j; k++) skip.add(k)
      }
      i = j
      continue
    }
    i++
  }
  return skip
}

export function getSpotlightGroupAtIndex(displaySections: FeedPostSection[], index: number): FeedPostSection[] | null {
  if (!isPlayerSpotlightPostLink(displaySections[index])) return null
  let start = index
  while (start > 0 && isPlayerSpotlightPostLink(displaySections[start - 1])) start--
  let end = index
  while (end + 1 < displaySections.length && isPlayerSpotlightPostLink(displaySections[end + 1])) end++
  const group = displaySections.slice(start, end + 1)
  return group.length >= 2 ? group : null
}
