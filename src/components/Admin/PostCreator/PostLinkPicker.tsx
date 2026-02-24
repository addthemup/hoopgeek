/**
 * PostLinkPicker — Modal for searching and selecting existing feed posts
 * to link to (either as a post_link section or inline within rich_text).
 *
 * Supports filtering by:
 *   - Free-text search (title, subtitle)
 *   - Post type
 *   - Team tricode
 *   - Date range
 *
 * Returns a LinkedPostRef on selection.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Input,
  Select,
  Option,
  Box,
  Stack,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Button,
  FormControl,
  FormLabel,
  Avatar,
} from '@mui/joy'
import { Search, Link as LinkIcon, FilterList } from '@mui/icons-material'
import { supabase } from '../../../utils/supabase'
import type { PostType, FeedTag } from '../../../types/feed'
import type { LinkedPostRef } from './types'
import { POST_TYPE_OPTIONS } from './constants'

interface PostLinkPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (ref: LinkedPostRef) => void
  /** Exclude this post ID from results (don't link to yourself) */
  excludePostId?: string
}

interface SearchFilters {
  query: string
  postType: PostType | 'all'
  teamTricode: string
  dateFrom: string
  dateTo: string
}

const INITIAL_FILTERS: SearchFilters = {
  query: '',
  postType: 'all',
  teamTricode: '',
  dateFrom: '',
  dateTo: '',
}

export default function PostLinkPicker({ open, onClose, onSelect, excludePostId }: PostLinkPickerProps) {
  const [filters, setFilters] = useState<SearchFilters>(INITIAL_FILTERS)
  const [results, setResults] = useState<LinkedPostRef[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [searched, setSearched] = useState(false)

  const search = useCallback(async () => {
    setLoading(true)
    setSearched(true)
    try {
      let query = supabase
        .from('feed_posts')
        .select('id, slug, title, subtitle, post_type, cover_image_url, game_date, team_tricodes')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(25)

      if (filters.query.trim()) {
        query = query.or(`title.ilike.%${filters.query.trim()}%,subtitle.ilike.%${filters.query.trim()}%`)
      }
      if (filters.postType !== 'all') {
        query = query.eq('post_type', filters.postType)
      }
      if (filters.teamTricode.trim()) {
        query = query.contains('team_tricodes', [filters.teamTricode.trim().toUpperCase()])
      }
      if (filters.dateFrom) {
        query = query.gte('game_date', filters.dateFrom)
      }
      if (filters.dateTo) {
        query = query.lte('game_date', filters.dateTo)
      }
      if (excludePostId) {
        query = query.neq('id', excludePostId)
      }

      const { data, error } = await query
      if (error) throw error

      setResults((data || []).map((row: any) => ({
        post_id: row.id,
        slug: row.slug,
        title: row.title,
        subtitle: row.subtitle,
        post_type: row.post_type as PostType,
        cover_image_url: row.cover_image_url,
        game_date: row.game_date,
        team_tricodes: row.team_tricodes,
      })))
    } catch (err) {
      console.error('PostLinkPicker search error:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [filters, excludePostId])

  // Search on open or when filters change (debounced via Enter/button)
  useEffect(() => {
    if (open) {
      search()
    } else {
      setFilters(INITIAL_FILTERS)
      setResults([])
      setSearched(false)
      setShowFilters(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search()
  }

  const typeColors: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {}
    for (const opt of POST_TYPE_OPTIONS) map[opt.value] = opt.color
    return map
  }, [])

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          maxWidth: 600,
          width: '95vw',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ModalClose />
        <Typography level="title-lg" startDecorator={<LinkIcon />} sx={{ mb: 2 }}>
          Link to Post
        </Typography>

        {/* Search bar */}
        <Stack direction="row" gap={1} sx={{ mb: 1 }}>
          <Input
            size="sm"
            placeholder="Search posts by title..."
            startDecorator={<Search />}
            value={filters.query}
            onChange={(e) => setFilters(f => ({ ...f, query: e.target.value }))}
            onKeyDown={handleKeyDown}
            sx={{ flex: 1 }}
          />
          <Button size="sm" variant="soft" onClick={() => setShowFilters(f => !f)} startDecorator={<FilterList />}>
            Filters
          </Button>
          <Button size="sm" variant="solid" onClick={search} loading={loading}>
            Search
          </Button>
        </Stack>

        {/* Expanded filters */}
        {showFilters && (
          <Card variant="outlined" size="sm" sx={{ mb: 1.5 }}>
            <CardContent>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <FormControl size="sm">
                  <FormLabel>Post Type</FormLabel>
                  <Select
                    size="sm"
                    value={filters.postType}
                    onChange={(_, v) => setFilters(f => ({ ...f, postType: (v as PostType | 'all') || 'all' }))}
                  >
                    <Option value="all">All Types</Option>
                    {POST_TYPE_OPTIONS.map(opt => (
                      <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="sm">
                  <FormLabel>Team</FormLabel>
                  <Input
                    size="sm"
                    placeholder="e.g. BOS"
                    value={filters.teamTricode}
                    onChange={(e) => setFilters(f => ({ ...f, teamTricode: e.target.value }))}
                  />
                </FormControl>
                <FormControl size="sm">
                  <FormLabel>From Date</FormLabel>
                  <Input
                    size="sm"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                  />
                </FormControl>
                <FormControl size="sm">
                  <FormLabel>To Date</FormLabel>
                  <Input
                    size="sm"
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                  />
                </FormControl>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size="sm" />
            </Box>
          ) : results.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography level="body-sm" sx={{ color: 'text.tertiary' }}>
                {searched ? 'No posts found matching your search.' : 'Search for a post to link to.'}
              </Typography>
            </Box>
          ) : (
            <Stack gap={1}>
              {results.map(ref => {
                const color = typeColors[ref.post_type] || '#FFC72C'
                const typeLabel = ref.post_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

                return (
                  <Card
                    key={ref.post_id}
                    variant="outlined"
                    size="sm"
                    onClick={() => {
                      onSelect(ref)
                      onClose()
                    }}
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.1s',
                      '&:hover': { borderColor: color, bgcolor: `${color}08` },
                    }}
                  >
                    <CardContent sx={{ display: 'flex', flexDirection: 'row', gap: 1.5, alignItems: 'center' }}>
                      {ref.cover_image_url && (
                        <Avatar
                          src={ref.cover_image_url}
                          variant="outlined"
                          sx={{ width: 48, height: 48, borderRadius: 'sm' }}
                        />
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" gap={0.5} alignItems="center" sx={{ mb: 0.25 }}>
                          <Chip
                            size="sm"
                            sx={{ bgcolor: `${color}22`, color, fontWeight: 700, fontSize: '0.6rem' }}
                          >
                            {typeLabel}
                          </Chip>
                          {ref.game_date && (
                            <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                              {ref.game_date}
                            </Typography>
                          )}
                          {ref.team_tricodes?.map(t => (
                            <Chip key={t} size="sm" variant="soft" sx={{ fontSize: '0.6rem' }}>{t}</Chip>
                          ))}
                        </Stack>
                        <Typography level="body-sm" sx={{ fontWeight: 600 }} noWrap>
                          {ref.title}
                        </Typography>
                        {ref.subtitle && (
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }} noWrap>
                            {ref.subtitle}
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                )
              })}
            </Stack>
          )}
        </Box>
      </ModalDialog>
    </Modal>
  )
}
