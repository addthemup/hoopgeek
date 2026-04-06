/**
 * Section Generator Registry
 *
 * Maps each PostType to a function that auto-generates SectionDraft[]
 * from the data loaded in Step 1 (data source). This replaces the
 * monolithic if/else tree in the old autoGenerateSections callback.
 *
 * Each generator receives a GeneratorContext and returns a promise of
 * SectionDraft[]. Generators are pure-ish functions that don't touch
 * React state — the caller merges the result into the draft.
 */

import type { PostType } from '../../../../types/feed'
import type { SectionGenerator } from '../types'
import { generateGameRecapSections } from './gameRecap'
import { generatePlayerSpotlightSections } from './playerSpotlight'
import { generateTeamLineupSections } from './teamLineup'
import { generatePlayerAwardSections } from './playerAward'
import { generateInjuryReportSections } from './injuryReport'
import { generatePropPredictionSections } from './propPrediction'
import { generatePropResultsSections } from './propResults'
import { generateUpcomingSections } from './upcoming'
import { generateDraftSections } from './draft'
import { generateDfsSections } from './dfs'
import { generateManualSections } from './manual'

const registry: Record<PostType, SectionGenerator> = {
  game_recap: generateGameRecapSections,
  player_spotlight: generatePlayerSpotlightSections,
  team_of_night: (ctx) => generateTeamLineupSections(ctx, 'totn'),
  team_of_week: (ctx) => generateTeamLineupSections(ctx, 'totw'),
  player_of_week: (ctx) => generatePlayerAwardSections(ctx, 'pow'),
  player_of_month: (ctx) => generatePlayerAwardSections(ctx, 'pom'),
  prop_prediction: generatePropPredictionSections,
  prop_results: generatePropResultsSections,
  injury_report: generateInjuryReportSections,
  upcoming: generateUpcomingSections,
  blog: generateManualSections,
  draft: generateDraftSections,
  dfs: generateDfsSections,
}

export function getSectionGenerator(postType: PostType): SectionGenerator {
  const gen = registry[postType]
  if (!gen) {
    console.warn('[SectionGen] No generator for', postType, '— falling back to manual')
  }
  return gen ?? generateManualSections
}

export { registry as sectionGenerators }
