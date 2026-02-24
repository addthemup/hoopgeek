/**
 * RichTextEditor — Enhanced rich text editor for feed post sections.
 *
 * Wraps a Textarea with a mini toolbar that supports:
 *   - Bold (**text**)
 *   - Headings (## / ###)
 *   - Insert post link via PostLinkPicker
 *   - Live preview of inline post links
 *
 * The stored format is markdown with inline post link syntax:
 *   {{post:/feed/slug|Display Text}}
 *
 * The PostStory renderer converts these to clickable internal links.
 */

import { useState, useRef, useCallback } from 'react'
import {
  Box,
  Stack,
  Textarea,
  IconButton,
  Tooltip,
  Typography,
  Chip,
} from '@mui/joy'
import {
  FormatBold,
  Title,
  Link as LinkIcon,
} from '@mui/icons-material'
import PostLinkPicker from './PostLinkPicker'
import type { LinkedPostRef } from './types'
import { parsePostLinks } from './utils'

interface RichTextEditorProps {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  minRows?: number
  maxRows?: number
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your content here...',
  minRows = 4,
  maxRows = 16,
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [cursorPos, setCursorPos] = useState(0)

  const getSelection = useCallback(() => {
    const el = textareaRef.current
    if (!el) return { start: 0, end: 0, text: '' }
    return { start: el.selectionStart, end: el.selectionEnd, text: value.slice(el.selectionStart, el.selectionEnd) }
  }, [value])

  const wrapSelection = useCallback((prefix: string, suffix: string) => {
    const { start, end, text } = getSelection()
    const wrapped = `${prefix}${text || 'text'}${suffix}`
    const next = value.slice(0, start) + wrapped + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) {
        el.focus()
        const newPos = start + prefix.length + (text || 'text').length
        el.setSelectionRange(newPos, newPos)
      }
    })
  }, [value, onChange, getSelection])

  const insertHeading = useCallback((level: 2 | 3) => {
    const { start } = getSelection()
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const prefix = '#'.repeat(level) + ' '
    const lineEnd = value.indexOf('\n', start)
    const actualEnd = lineEnd === -1 ? value.length : lineEnd
    const currentLine = value.slice(lineStart, actualEnd)

    const cleanedLine = currentLine.replace(/^#{1,6}\s*/, '')
    const next = value.slice(0, lineStart) + prefix + cleanedLine + value.slice(actualEnd)
    onChange(next)
  }, [value, onChange, getSelection])

  const handleLinkPost = useCallback(() => {
    const el = textareaRef.current
    setCursorPos(el ? el.selectionStart : value.length)
    setPickerOpen(true)
  }, [value])

  const handlePostSelected = useCallback((ref: LinkedPostRef) => {
    const link = `{{post:/feed/${ref.slug}|${ref.title}}}`
    const next = value.slice(0, cursorPos) + link + value.slice(cursorPos)
    onChange(next)
  }, [value, cursorPos, onChange])

  // Parse existing post links for the preview chips
  const linkedPosts = parsePostLinks(value)

  return (
    <Box>
      {/* Toolbar */}
      <Stack
        direction="row"
        gap={0.5}
        sx={{
          mb: 0.5,
          p: 0.5,
          borderRadius: 'sm',
          bgcolor: 'background.level1',
          border: '1px solid',
          borderColor: 'divider',
          borderBottom: 'none',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }}
      >
        <Tooltip title="Bold">
          <IconButton size="sm" variant="plain" onClick={() => wrapSelection('**', '**')}>
            <FormatBold sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Heading (##)">
          <IconButton size="sm" variant="plain" onClick={() => insertHeading(2)}>
            <Title sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Subheading (###)">
          <IconButton size="sm" variant="plain" onClick={() => insertHeading(3)}>
            <Typography level="body-xs" sx={{ fontWeight: 700, fontSize: '0.65rem' }}>H3</Typography>
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Insert post link">
          <IconButton
            size="sm"
            variant="soft"
            color="warning"
            onClick={handleLinkPost}
          >
            <LinkIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Textarea */}
      <Textarea
        slotProps={{ textarea: { ref: textareaRef } }}
        size="sm"
        minRows={minRows}
        maxRows={maxRows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        }}
      />

      {/* Linked posts preview */}
      {linkedPosts.length > 0 && (
        <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
          <Typography level="body-xs" sx={{ color: 'text.tertiary', mr: 0.5, alignSelf: 'center' }}>
            Linked:
          </Typography>
          {linkedPosts.map((lp, i) => (
            <Chip
              key={`${lp.slug}-${i}`}
              size="sm"
              variant="soft"
              color="warning"
              startDecorator={<LinkIcon sx={{ fontSize: 12 }} />}
            >
              {lp.displayText}
            </Chip>
          ))}
        </Stack>
      )}

      {/* PostLinkPicker modal */}
      <PostLinkPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePostSelected}
      />
    </Box>
  )
}
