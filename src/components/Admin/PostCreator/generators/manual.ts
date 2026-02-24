/**
 * Manual section generator — for post types without automatic data sources.
 *
 * Produces a basic scaffold: hero → headline → rich_text
 * Used by: prop_prediction, prop_results, injury_report, upcoming, blog
 */

import type { HeroContent, HeadlineContent } from '../../../../types/feed'
import type { SectionDraft, GeneratorContext } from '../types'
import { nextSectionId, resetSectionIdCounter } from '../utils'
import { POST_TYPE_OPTIONS } from '../constants'

export async function generateManualSections(ctx: GeneratorContext): Promise<SectionDraft[]> {
  const { draft } = ctx

  resetSectionIdCounter()
  const sections: SectionDraft[] = []
  const typeOpt = POST_TYPE_OPTIONS.find(o => o.value === draft.post_type)
  const badge = typeOpt?.label?.toUpperCase() || draft.post_type.replace(/_/g, ' ').toUpperCase()

  // Hero
  sections.push({
    id: nextSectionId(),
    section_type: 'hero',
    title: '',
    content: {
      image_url: draft.cover_image_url || '',
      gradient_overlay: true,
      badge,
    } satisfies HeroContent,
    player_id: null,
    team_tricode: null,
  })

  // Headline
  sections.push({
    id: nextSectionId(),
    section_type: 'headline',
    title: '',
    content: {
      text: draft.title || `New ${typeOpt?.label || 'Post'}`,
      subtitle: draft.subtitle || '',
    } satisfies HeadlineContent,
    player_id: null,
    team_tricode: null,
  })

  // Rich text body
  sections.push({
    id: nextSectionId(),
    section_type: 'rich_text',
    title: '',
    content: {
      markdown: `## ${draft.title || typeOpt?.label || 'Post'}\n\n*Start writing here...*`,
    },
    player_id: null,
    team_tricode: null,
  })

  return sections
}
