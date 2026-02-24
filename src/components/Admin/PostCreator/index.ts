/**
 * PostCreator module — public API.
 *
 * Import from '@/components/Admin/PostCreator' to access types,
 * constants, generators, and components without reaching into internals.
 */

// Types
export type {
  PostTypeOption,
  DataSourceMode,
  ResolvedPlayer,
  PlayByPlayAction,
  GameData,
  NbaGame,
  SectionDraft,
  PostDraft,
  GeneratorContext,
  SectionGenerator,
  LinkedPostRef,
} from './types'

export { EMPTY_DRAFT } from './types'

// Constants
export {
  POST_TYPE_OPTIONS,
  SECTION_TYPE_OPTIONS,
  TAG_OPTIONS,
  LINEUP_SLOTS,
  getDefaultSectionContent,
} from './constants'

// Utilities
export {
  generateSlug,
  generateSourceRef,
  formatSalary,
  nextSectionId,
  resetSectionIdCounter,
  parsePostLinks,
  insertPostLink,
  renderPostLinks,
} from './utils'

// Generator registry
export { getSectionGenerator, sectionGenerators } from './generators'

// Components
export { default as PostLinkPicker } from './PostLinkPicker'
export { default as RichTextEditor } from './RichTextEditor'
