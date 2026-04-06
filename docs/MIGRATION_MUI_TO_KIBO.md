# Migration: MUI Joy → Kibo (Tailwind + shadcn)

This doc tracks the move from MUI Joy + newspaper theme to a single design system: **Kibo** (Tailwind + shadcn-style components in `@/components/ui`).

---

## Roadmap (next 2–3 steps)

| Step | Scope | Goal | Status |
|------|--------|------|--------|
| **1** | `useMediaQuery` hook + **Layout.tsx** | Drop MUI from app shell wrapper; one less `@mui` import in the tree. | ✅ Done |
| **2** | **TopNavigation.tsx** | Nav bar and bottom nav on Kibo (Button, Box, Stack, Typography, Input, Dialog, Avatar); mobile search modal. | ✅ Done |
| **3** | **FeedThumbnails.tsx** | First feed component on Kibo (Box, Typography, Badge, Aspect16_9); template for rest of Feed. | ✅ Done |

Do one step at a time to keep changes small and reviewable.

---

## Done

- **Global CSS reset:** `index.css` and `App.css` rewritten. No newspaper fonts, no forced dark, no newsprint vars. Light-first with `.dark` support via CSS variables.
- **App entry:** `main.tsx` no longer uses `newspaperTheme` or `DarkModeForce`. Mode is `system` (respects OS preference).
- **Kibo primitives added:** `Box`, `Stack`, `Typography` in `src/components/ui/` with optional `sx` for migration. Plus `Card`, `Badge` (shadcn-style).
- **`sxToStyle`** in `@/lib/utils` for simple MUI-style `sx` objects (p, m, gap, bgcolor, etc.) so existing code can keep `sx` during migration.
- **Step 1:** `useMediaQuery` hook (`src/hooks/useMediaQuery.ts`) and **Layout.tsx** migrated to Kibo (Box + Tailwind). Layout no longer imports from `@mui/joy` or `@mui/material`.
- **Step 2:** **TopNavigation.tsx** migrated to Kibo: Box, Stack, Typography, Button, Input, Avatar, Dialog (see `@/components/ui/input`, `@/components/ui/dialog`). Desktop nav, bottom tabs, search dropdown, and mobile search modal all use Kibo. MUI icons (Home, Search, Person, AttachMoney, DynamicFeed) kept; Loader2 from lucide-react for spinner.
- **Step 3:** **FeedThumbnails.tsx** migrated to Kibo: Box, Typography, Badge, local `Aspect16_9` (aspect-video). All thumbnail variants (prop_results, prop_prediction, team_of_week/night, cover image, player_spotlight, fallback) use Kibo.

## Component mapping (use when editing a file)

| MUI Joy | Kibo / shadcn |
|--------|----------------|
| `Box` | `Box` from `@/components/ui/box` or plain `div` + `className={cn(...)}` |
| `Stack` | `Stack` from `@/components/ui/stack` or `div` with `flex flex-col` / `flex-row` + gap |
| `Typography` | `Typography` from `@/components/ui/typography` or semantic tags + Tailwind text classes |
| `Chip` | `Badge` from `@/components/ui/badge` |
| `Card`, `CardContent` | `Card`, `CardContent` from `@/components/ui/card` |
| `Button` | `Button` from `@/components/ui/button` |
| `IconButton` | `Button variant="ghost" size="icon"` from `@/components/ui/button` |
| `Sheet` | Add shadcn `Sheet` (or use a `div` + Tailwind for simple panels) |
| `Drawer` | shadcn `Sheet` (side panel) or custom with Tailwind |
| `Modal`, `ModalDialog`, `DialogTitle`, `DialogContent`, `ModalClose` | Add shadcn `Dialog` |
| `Input`, `Textarea`, `Select` | Add shadcn `Input`, etc., or use native + Tailwind |
| `Avatar` | `Avatar` from `@/components/ui/avatar` |
| `AspectRatio` | `aspect-video` / `aspect-square` (Tailwind) or add shadcn AspectRatio |
| `Alert` | Add shadcn `Alert` or a simple div + Tailwind |
| `useMediaQuery` | Keep `@mui/material` for now, or add a small `useMediaQuery` hook with `window.matchMedia` |

## useMediaQuery

Many files use `useMediaQuery` from `@mui/material`. Options:

1. **Keep** `@mui/material` until the rest of MUI is gone (minimal dependency).
2. **Replace** with a local hook, e.g. in `src/hooks/useMediaQuery.ts`:

```ts
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    setMatches(m.matches);
    const handler = () => setMatches(m.matches);
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, [query]);
  return matches;
}
```

Then replace `useMediaQuery(theme.breakpoints.down('sm'))` with `useMediaQuery('(max-width: 600px')` (or use a small constants object for breakpoints).

## Files to migrate (order is suggestion)

Migrate by changing imports from `@mui/joy` (and where applicable `@mui/icons-material`) to Kibo/shadcn, and replace `sx` with `className` + Tailwind (or keep `sx` on Box/Stack/Typography during transition).

### Shell & layout (do first)

- `src/components/Layout.tsx`
- `src/components/TopNavigation.tsx`
- `src/App.tsx` (if it has MUI)

### Feed

- `src/components/Feed/FeedThumbnails.tsx`
- `src/components/Feed/FeedModulesGrid.tsx`
- `src/components/Feed/SlipBuilderModule.tsx`
- `src/components/Feed/DFSModule.tsx`
- `src/components/Feed/AdminLayout.tsx`
- `src/components/Feed/TeamPageLayout.tsx`
- `src/components/Feed/PlayerPageLayout.tsx`
- `src/components/Feed/FavoritePlayersCarousel.tsx`
- `src/components/Feed/DraftModule.tsx`

### Pages (high traffic / visible)

- `src/pages/Home.tsx`
- `src/pages/Login.tsx`
- `src/pages/PostStory.tsx`
- `src/pages/Post.tsx`
- `src/pages/PostCreator.tsx`
- `src/pages/Highlights.tsx`
- `src/pages/Today.tsx`
- `src/pages/AdminFeed.tsx`
- `src/pages/AdminContent.tsx`
- `src/pages/AdminContentGame.tsx`
- … then remaining pages under `src/pages/`

### Components (by area)

- `src/components/Admin/*` (FeedContentManager, GamesWithPosts, PostCreator/*, etc.)
- `src/components/Feed/*` (above)
- `src/components/modules/*` (TeamOfWeekModuleDisplay, TeamOfNightModuleDisplay, PropModuleDisplay, etc.)
- `src/components/Today/*`, `src/components/TodayFeed/*`
- `src/components/PlayerCharts/*`, `src/components/Team/*`, `src/components/Draft/*`, `src/components/DFS/*`, etc.

Full list of files that still import from `@mui/joy` (as of this doc): run  
`grep -rl "from '@mui/joy'" src --include="*.tsx" --include="*.ts"`.

## After all components are migrated

1. Remove `CssVarsProvider` and `CssBaseline` from `main.tsx` (and any MUI imports).
2. Delete `src/theme.ts` and `src/DarkModeForce.tsx` if unused.
3. Remove from `package.json`: `@mui/joy`, `@emotion/react`, `@emotion/styled`. Optionally keep or remove `@mui/icons-material` (or switch to lucide-react everywhere).
4. Keep or migrate `@mui/x-charts`, `@mui/x-date-pickers`, `@mui/x-data-grid` (they can stay on Material theme or be wrapped in a minimal theme).

## Dark mode

The new CSS uses `:root` for light and `.dark` for dark. To toggle dark mode, add a class `dark` on `<html>` (e.g. from a small theme context or a script that reads `localStorage` / system preference). No MUI theme required.
