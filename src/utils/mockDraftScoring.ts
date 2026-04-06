import { supabase } from './supabase';

/**
 * Phase 1 scoring: 10 points per exact pick (pick_number + prospect_id matches result).
 * Call from admin after results are saved.
 */
export async function recomputeMockDraftScoresForYear(draftYear: number): Promise<{ updated: number }> {
  const { data: results, error: resErr } = await supabase
    .from('mock_draft_results')
    .select('pick_number, draft_prospect_id')
    .eq('draft_year', draftYear);
  if (resErr) throw resErr;
  if (!results?.length) return { updated: 0 };

  const resultByPick = new Map(
    results.filter((r) => r.draft_prospect_id).map((r) => [r.pick_number, r.draft_prospect_id as string])
  );

  const { data: allDrafts, error: draftsErr } = await supabase
    .from('user_mock_drafts')
    .select('id, user_id')
    .eq('draft_year', draftYear);
  if (draftsErr) throw draftsErr;

  let updated = 0;
  for (const draft of allDrafts ?? []) {
    const { data: picks, error: picksErr } = await supabase
      .from('user_mock_draft_picks')
      .select('pick_number, draft_prospect_id')
      .eq('user_mock_draft_id', draft.id);
    if (picksErr) throw picksErr;

    let pointsTotal = 0;
    const breakdown: Record<string, number> = {};
    for (const p of picks ?? []) {
      const actual = resultByPick.get(p.pick_number);
      if (actual && actual === p.draft_prospect_id) {
        pointsTotal += 10;
        breakdown[`pick_${p.pick_number}`] = 10;
      }
    }

    const { error: upErr } = await supabase.from('mock_draft_scores').upsert(
      {
        user_id: draft.user_id,
        draft_year: draftYear,
        points_total: pointsTotal,
        breakdown,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,draft_year' }
    );
    if (upErr) throw upErr;
    updated++;
  }

  return { updated };
}
