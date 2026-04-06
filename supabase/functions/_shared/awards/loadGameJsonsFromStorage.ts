import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { rawJsonToGameData, type GameData } from './gameDataFromRaw.ts'

function storageObjectPath(prefix: string, gameId: string): string {
  const p = prefix.replace(/\/$/, '')
  return p ? `${p}/${gameId}.json` : `${gameId}.json`
}

export async function loadGameJsonsForIds(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
  gameIds: string[],
): Promise<GameData[]> {
  const out: GameData[] = []
  for (const gameId of gameIds) {
    const path = storageObjectPath(prefix, gameId)
    const { data: blob, error } = await supabase.storage.from(bucket).download(path)
    if (error || !blob) continue
    try {
      const text = await blob.text()
      const raw = JSON.parse(text) as Record<string, unknown>
      const gd = rawJsonToGameData(raw)
      if (gd) out.push(gd)
    } catch {
      /* skip invalid */
    }
  }
  return out
}
