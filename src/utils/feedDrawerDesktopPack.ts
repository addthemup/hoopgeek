/**
 * Packs feed drawer modules into carousel slides (2×2 CSS grid per slide).
 * Layout is configured per module in admin (`feed_module_visibility.desktop_layout`).
 */

export type FeedDesktopDrawerLayout = 'cell' | 'tall' | 'wide' | 'full';

export interface PackedDrawerPlacement {
  name: string;
  gridColumn: string;
  gridRow: string;
}

const K = (c: number, r: number) => `${c},${r}`;

export function normalizeDesktopLayout(value: string | null | undefined): FeedDesktopDrawerLayout {
  if (value === 'tall' || value === 'wide' || value === 'full' || value === 'cell') return value;
  return 'cell';
}

/**
 * Greedy pack: walks modules in order, fills current 2×2 slide, starts new slide when full or when needed.
 * - `cell`: one quadrant
 * - `tall`: one column × full height (2 rows)
 * - `wide`: one row × full width (2 cols)
 * - `full`: alone on its own slide (uses entire 2×2)
 */
export function packFeedDrawerDesktopSlides(
  modules: { name: string; desktop_layout: string | null | undefined }[]
): PackedDrawerPlacement[][] {
  const slides: PackedDrawerPlacement[][] = [];
  let slide: PackedDrawerPlacement[] = [];
  let occ = new Set<string>();

  const flush = () => {
    if (slide.length > 0) {
      slides.push(slide);
      slide = [];
      occ = new Set();
    }
  };

  const free = (c: number, r: number) => !occ.has(K(c, r));

  const mark = (cells: [number, number][]) => {
    cells.forEach(([c, r]) => occ.add(K(c, r)));
  };

  const emptySlide = () => occ.size === 0;

  const tryPlace = (name: string, layout: FeedDesktopDrawerLayout): boolean => {
    if (layout === 'full') {
      if (!emptySlide()) return false;
      slide.push({ name, gridColumn: '1 / -1', gridRow: '1 / -1' });
      mark([
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]);
      return true;
    }
    if (layout === 'tall') {
      if (free(0, 0) && free(0, 1)) {
        slide.push({ name, gridColumn: '1 / 2', gridRow: '1 / 3' });
        mark([
          [0, 0],
          [0, 1],
        ]);
        return true;
      }
      if (free(1, 0) && free(1, 1)) {
        slide.push({ name, gridColumn: '2 / 3', gridRow: '1 / 3' });
        mark([
          [1, 0],
          [1, 1],
        ]);
        return true;
      }
      return false;
    }
    if (layout === 'wide') {
      if (free(0, 0) && free(1, 0)) {
        slide.push({ name, gridColumn: '1 / 3', gridRow: '1 / 2' });
        mark([
          [0, 0],
          [1, 0],
        ]);
        return true;
      }
      if (free(0, 1) && free(1, 1)) {
        slide.push({ name, gridColumn: '1 / 3', gridRow: '2 / 3' });
        mark([
          [0, 1],
          [1, 1],
        ]);
        return true;
      }
      return false;
    }
    // cell
    for (const [c, r] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as [number, number][]) {
      if (free(c, r)) {
        slide.push({ name, gridColumn: `${c + 1} / ${c + 2}`, gridRow: `${r + 1} / ${r + 2}` });
        mark([[c, r]]);
        return true;
      }
    }
    return false;
  };

  for (const mod of modules) {
    const layout = mod.name === 'slip_builder' ? 'full' : normalizeDesktopLayout(mod.desktop_layout);

    if (layout === 'full') {
      flush();
      tryPlace(mod.name, 'full');
      flush();
      continue;
    }

    if (!tryPlace(mod.name, layout)) {
      flush();
      if (!tryPlace(mod.name, layout)) {
        flush();
        tryPlace(mod.name, 'cell');
      }
    }

    if (occ.size === 4) flush();
  }

  flush();
  return slides;
}
