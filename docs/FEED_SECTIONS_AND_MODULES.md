# Feed post section types and module alignment

## Principle: frozen data, shared display

- **Drawer modules** (Standings, Injuries, Prop Predictions, etc.) always show **live** data from the app.
- **Feed posts** store **frozen** data in section `content` (and optionally in post `metadata`).
- When a section type is a **module embed** (`*_module`), the **same display component** used by the live module is used to render that section in the post. So when you change the module’s UI, past posts automatically get the updated look.

So: **pass live data into the post as frozen content (and metadata if needed); in the feed we only render that frozen data with the shared component.**

---

## All section types (current)

| Section type | Description | Rendered by | Module alignment |
|--------------|-------------|------------|-------------------|
| `hero` | Cover image / title card | PostStory (custom) | — |
| `headline` | Text headline + subtitle | PostStory (custom) | — |
| `lineup_card` | Starters + bench (TOTN/TOTW legacy) | PostStory (custom) | Replaced by `team_of_night_module` / `team_of_week_module` in generators |
| `player_highlight` | Player card + stats + video | PostStory (custom) | — |
| `stat_comparison` | Side‑by‑side team/player bars | PostStory (custom) | — |
| `video_clip` | Single embedded video | PostStory (custom) | — |
| `video_carousel` | Carousel of clips | PostStory (custom) | — |
| `chart` | Chart placeholder | PostStory (custom) | — |
| `rich_text` | Markdown block | PostStory (custom) | — |
| `prop_card` | Single prop line (legacy) | PostStory (custom) | Replaced by `prop_module` in generators |
| `injury_card` | Single injury (legacy) | PostStory (custom) | Replaced by `injury_module` in generators |
| `pull_quote` | Stat/quote callout | PostStory (custom) | — |
| `gallery` | Multi-image | PostStory (custom) | — |
| `box_score` | Box score table | PostStory (custom) | — |
| `game_log` | Player game log | PostStory (custom) | — |
| `post_link` | Link to another post | PostStory (custom) | — |
| `tweet_embed` | X embed | PostStory (custom) | — |
| **`injury_module`** | Frozen Injuries module | **InjuryModuleDisplay** | ✅ Same as drawer Injuries |
| **`prop_module`** | Frozen Prop Predictions/Results | **PropModuleDisplay** | ✅ Same as drawer Props |
| **`team_of_night_module`** | Frozen TOTN lineup | **TeamOfNightModuleDisplay** | ✅ Same as TOTN module |
| **`team_of_week_module`** | Frozen TOTW lineup | **TeamOfWeekModuleDisplay** | ✅ Same as TOTW module |
| **`tank_module`** | Frozen Tank tab (standings + draft) | **TankModuleDisplay** | ✅ Same as Standings Tank tab |

---

## Post types (current)

- `game_recap`, `player_spotlight`, `team_of_night`, `team_of_week`, `player_of_week`, `player_of_month`
- `prop_prediction`, `prop_results`, `injury_report`, `upcoming`, `blog`
- **`draft`** — tank race snapshot (standings + draft prospect rankings), frozen from daily maintenance.

---

## What keeps feed posts in line with modules

1. **Generators**  
   For each post type that should mirror a module, the generator fetches the **same** data the module would (standings, injuries, props, draft rankings, etc.) and writes it into section content (and optionally post metadata). No extra “live” fetch in the post view.

2. **Section content shape**  
   Module-embed section types have a single content shape (e.g. `InjuryModuleContent`, `TankModuleContent`) that holds the frozen payload. The live module can accept the same shape when you later refactor it to use the shared component with “live” data passed in.

3. **Shared display components**  
   `InjuryModuleDisplay`, `PropModuleDisplay`, `TeamOfNightModuleDisplay`, `TeamOfWeekModuleDisplay`, `TankModuleDisplay` live under `src/components/modules/`. PostStory uses them for the corresponding `*_module` section types. When you change one of these components, both the drawer and the post view update.

4. **Optional: refactor live modules**  
   Today the drawer still has its own inline UI for Standings (including Tank), Injuries, Props, TOTN, TOTW. To get one single place to change behavior and layout, you can refactor each of those to:
   - Fetch live data in the page/drawer as today,
   - Pass that data into the same `*ModuleDisplay` component used in PostStory.

   Then feed posts and drawer stay in line by construction.

---

## How far we have to go

- **Done**
  - Post type **draft** and section type **tank_module**; generator freezes standings + draft rankings; `TankModuleDisplay` matches Tank tab.
  - **injury_module**, **prop_module**, **team_of_night_module**, **team_of_week_module** types, generators, and shared displays are implemented; generators output these instead of (or in addition to) legacy `injury_card` / `prop_card` / `lineup_card` where appropriate.
  - PostStory renders all `*_module` section types with the shared components.

- **Optional next steps**
  1. **Refactor live modules**  
     StandingsModule (Tank tab), InjuriesModule, PropPredictionsModule (`embedMode`: over / under / team_confidence / player_confidence / full), PropPerformanceModule, TeamOfNightModule, TeamOfWeekModule: have each call the corresponding `*ModuleDisplay` with its live data so there is a single UI for both “live” and “frozen”.
  2. **Other drawer modules as post sections**  
     Any other drawer module (e.g. Leaders, Favorite Players, Games Carousel) can get a `*_module` section type and shared display the same way: define content type → add section type → implement `*ModuleDisplay` → generator that freezes the same data → use in PostStory.
  3. **Legacy section types**  
     You can keep `injury_card`, `prop_card`, `lineup_card` for backward compatibility with old posts; new posts use the `*_module` sections. No obligation to migrate old content unless you want to.

---

## Draft post type (summary)

- **Purpose:** Snapshot of the **Tank** tab (worst 14 teams + lottery odds + draft prospect at each pick). Data is frozen at post-creation time from current standings and latest draft_rankings snapshot.
- **Data source:** `nba_standings` (current season) + `draft_rankings` (latest `snapshot_week`) + `draft_prospects`. Same inputs as the Standings Tank tab and draft aggregate from daily maintenance.
- **Sections produced:** `hero` → `headline` → `tank_module` (with `rows`, `season`, `snapshot_date`, optional `snapshot_week`).
- **Creating a draft post:** In Post Creator, choose post type **Draft** (data source mode is “manual”). Add title/subtitle if you want, then **Auto-generate** to freeze current tank + draft data. Publish when ready.
