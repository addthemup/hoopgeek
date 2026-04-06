/**
 * DFS post section generator (framework stub).
 *
 * Will pull from dfs_pools, dfs_entries, dfs_group_pools, etc. and build
 * hero → headline → dfs_module. For now returns a minimal snapshot placeholder.
 */

import type { HeroContent, HeadlineContent, DfsModuleContent } from '../../../../types/feed'
import type { SectionDraft, GeneratorContext } from '../types'
import { nextSectionId, resetSectionIdCounter } from '../utils'
import { supabase } from '../../../../utils/supabase'

export async function generateDfsSections(ctx: GeneratorContext): Promise<SectionDraft[]> {
  resetSectionIdCounter()
  const sections: SectionDraft[] = []
  const draft = ctx.draft
  const snapshotDate = new Date().toISOString().slice(0, 10)

  sections.push({
    id: nextSectionId(),
    section_type: 'hero',
    title: '',
    content: {
      image_url: draft.cover_image_url || '',
      gradient_overlay: true,
      badge: 'DFS',
    } satisfies HeroContent,
    player_id: null,
    team_tricode: null,
  })

  sections.push({
    id: nextSectionId(),
    section_type: 'headline',
    title: '',
    content: {
      text: draft.title || `DFS — ${snapshotDate}`,
      subtitle: draft.subtitle || snapshotDate,
    } satisfies HeadlineContent,
    player_id: null,
    team_tricode: null,
  })

  // Stub: fetch public pools for snapshot (framework for later full integration)
  let dfsContent: DfsModuleContent = {
    snapshot_date: snapshotDate,
    message: 'DFS data will be integrated here. Use dfs_pools, dfs_entries, dfs_group_pools, etc.',
  }
  try {
    const { data: pools } = await supabase
      .from('dfs_pools')
      .select('id, name, status')
      .eq('is_public', true)
      .order('lock_time', { ascending: false })
      .limit(10)
    if (pools?.length) {
      dfsContent = {
        snapshot_date: snapshotDate,
        pools: pools.map((p: any) => ({ id: p.id, name: p.name, status: p.status || '' })),
      }
    }
  } catch (_) {
    // keep placeholder content
  }

  sections.push({
    id: nextSectionId(),
    section_type: 'dfs_module',
    title: '',
    content: dfsContent,
    player_id: null,
    team_tricode: null,
  })

  return sections
}
