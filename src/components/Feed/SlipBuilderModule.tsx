/**
 * Slip Builder drawer module: build a parlay from Prop Predictions, see total odds and payout, save to DB.
 * Ghost: only visible when current slip has legs or user has saved slips today. Track today's slips only.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Stack,
  IconButton,
  Input,
  Divider,
  Alert,
  Modal,
  ModalDialog,
  ModalClose,
  Select,
  Option,
} from '@mui/joy';
import { useQuery } from '@tanstack/react-query';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import ArrowBackIosNewRounded from '@mui/icons-material/ArrowBackIosNewRounded';
import Save from '@mui/icons-material/Save';
import dayjs from 'dayjs';
import { useSlipBuilder, type SlipLeg } from '../../contexts/SlipBuilderContext';
import { useFeedDrawerRestoreOptional } from '../../contexts/FeedDrawerRestoreContext';
import { useAuth } from '../../hooks/useAuth';
import { useToggleSlipShare } from '../../hooks/useSharedSlip';
import { supabase } from '../../utils/supabase';
import { getTodayEST } from '../../utils/nbaDateUtils';

function formatBetType(betType: string): string {
  const n = betType.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+').replace(/-/g, '+');
  const map: Record<string, string> = {
    points: 'PTS',
    rebounds: 'REB',
    assists: 'AST',
    threes: '3PM',
    steals: 'STL',
    blocks: 'BLK',
    turnovers: 'TOV',
    ftm: 'FTM',
    fga: 'FGA',
    fgm: 'FGM',
    fg3a: '3PA',
    fg3m: '3PM',
    par: 'P+A+R',
  };
  return map[n] ?? betType?.toUpperCase?.() ?? '—';
}

function toUuidOrNull(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRe.test(raw) ? raw : null;
}

function normalizeBetTypeForLive(betType: string): string {
  return String(betType || '')
    .toLowerCase()
    .replace(/[+\s]/g, '_')
    .replace(/__+/g, '_')
    .replace(/-/g, '_')
    .trim();
}

function getLiveValueForBetType(
  betType: string,
  stats: Record<string, number | null | undefined> | null | undefined
): number | null {
  if (!stats) return null;
  const safe = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
  const normalized = normalizeBetTypeForLive(betType);
  if (normalized === 'points') return safe(stats.pts);
  if (normalized === 'rebounds') return safe(stats.reb);
  if (normalized === 'assists') return safe(stats.ast);
  if (normalized === 'steals') return safe(stats.stl);
  if (normalized === 'blocks') return safe(stats.blk);
  if (normalized === 'turnovers') return safe(stats.tov);
  if (normalized === 'threes' || normalized === 'three_pointers' || normalized === 'threepointersmade') {
    return safe(stats.fg3m);
  }
  if (normalized === 'freethrowsmade') return safe(stats.ftm);
  if (normalized === 'fieldgoalsmade') return safe(stats.fgm);
  if (normalized === 'fieldgoalsattempted') return safe(stats.fga);
  if (normalized === 'threepointersattempted') return safe(stats.fg3a);
  if (normalized === 'points_rebounds') return safe(stats.pts) + safe(stats.reb);
  if (normalized === 'points_assists') return safe(stats.pts) + safe(stats.ast);
  if (normalized === 'rebounds_assists') return safe(stats.reb) + safe(stats.ast);
  if (normalized === 'points_rebounds_assists' || normalized === 'pra' || normalized === 'par') {
    return safe(stats.pts) + safe(stats.reb) + safe(stats.ast);
  }
  return null;
}

function buildSlipShareText(args: {
  stakeCents?: number;
  potentialPayoutCents?: number;
  totalOddsDecimal?: number;
  legs: Array<{ player_name: string; bet_type: string; line: number; side: string }>;
}): string {
  const header = `Slip: ${args.legs.length} legs · Stake $${((args.stakeCents ?? 0) / 100).toFixed(2)} · Payout $${((args.potentialPayoutCents ?? 0) / 100).toFixed(2)} · Odds ${(args.totalOddsDecimal ?? 1).toFixed(2)}x`;
  const lines = args.legs.slice(0, 8).map((leg) => `- ${leg.player_name} ${formatBetType(leg.bet_type)} ${leg.line} ${leg.side === 'over' ? 'O' : 'U'}`);
  return [header, ...lines].join('\n');
}

export default function SlipBuilderModule() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    legs,
    stake_cents,
    setStakeCents,
    removeLeg,
    clearSlip,
    totalOddsDecimal,
    potentialPayoutCents,
    savedSlips,
    savedSlipsLoading,
    savedSlipsSort,
    setSavedSlipsSort,
    hasMoreSavedSlips,
    isFetchingMoreSavedSlips,
    fetchNextSavedSlips,
    refetchSavedSlips,
  } = useSlipBuilder();
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toggleSlipShare = useToggleSlipShare();
  const feedRestore = useFeedDrawerRestoreOptional();
  const savedScrollRef = useRef<HTMLDivElement | null>(null);

  const todayDate = getTodayEST();
  const hasActiveSlip = legs.length > 0;
  const hasSavedSlips = savedSlips.length > 0;
  const activePlayerIds = useMemo(
    () =>
      Array.from(
        new Set(
          legs
            .map((leg) => Number(leg.nba_player_id))
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      ),
    [legs]
  );
  const savedSlipPlayerIds = useMemo(
    () =>
      Array.from(
        new Set(
          savedSlips
            .flatMap((slip) => slip.legs ?? [])
            .map((leg) => Number(leg.nba_player_id))
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      ),
    [savedSlips]
  );
  const allRelevantPlayerIds = useMemo(
    () => Array.from(new Set([...activePlayerIds, ...savedSlipPlayerIds])),
    [activePlayerIds, savedSlipPlayerIds]
  );
  const allSlipGameIds = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...legs.map((leg) => toUuidOrNull(leg.game_id)),
            ...savedSlips.flatMap((slip) => slip.legs ?? []).map((leg) => toUuidOrNull(leg.game_id)),
          ]
            .filter((value): value is string => !!value)
        )
      ),
    [legs, savedSlips]
  );
  const { data: propsGameIdMap = new Map<string, string>() } = useQuery({
    queryKey: ['slip-builder-props-game-map', allSlipGameIds.join(',')],
    queryFn: async () => {
      if (!allSlipGameIds.length) return new Map<string, string>();
      const { data, error } = await supabase
        .from('player_props_games')
        .select('id, nba_game_id')
        .in('id', allSlipGameIds);
      if (error || !data) return new Map<string, string>();
      const map = new Map<string, string>();
      (data || []).forEach((row: { id: string; nba_game_id: string | null }) => {
        if (row.id && row.nba_game_id) map.set(row.id, row.nba_game_id);
      });
      return map;
    },
    enabled: allSlipGameIds.length > 0,
  });
  const allSlipNbaGameIds = useMemo(
    () => Array.from(new Set(Array.from(propsGameIdMap.values()).filter(Boolean))),
    [propsGameIdMap]
  );

  const { data: playerRows = [] } = useQuery({
    queryKey: ['slip-builder-player-meta', allRelevantPlayerIds.join(',')],
    queryFn: async () => {
      if (!allRelevantPlayerIds.length) {
        return [] as Array<{
          nba_player_id: number;
          name: string | null;
          team_abbreviation: string | null;
          position: string | null;
          jersey_number: string | null;
        }>;
      }
      const { data, error } = await supabase
        .from('nba_players')
        .select('nba_player_id, name, team_abbreviation, position, jersey_number')
        .in('nba_player_id', allRelevantPlayerIds);
      if (error) return [];
      return (data ?? []) as Array<{
        nba_player_id: number;
        name: string | null;
        team_abbreviation: string | null;
        position: string | null;
        jersey_number: string | null;
      }>;
    },
    enabled: allRelevantPlayerIds.length > 0,
  });

  const { data: livePlayerStatsRows = [] } = useQuery({
    queryKey: ['slip-builder-live-player-stats', allSlipNbaGameIds.join(',')],
    queryFn: async () => {
      if (!allSlipNbaGameIds.length) {
        return [] as Array<{
          game_id: string;
          nba_player_id: number;
          stats: Record<string, number | null | undefined> | null;
          updated_at: string;
        }>;
      }
      const { data, error } = await supabase
        .from('live_player_stats')
        .select('game_id, nba_player_id, stats, updated_at')
        .in('game_id', allSlipNbaGameIds);
      if (error) return [];
      return (data ?? []) as Array<{
        game_id: string;
        nba_player_id: number;
        stats: Record<string, number | null | undefined> | null;
        updated_at: string;
      }>;
    },
    enabled: allSlipNbaGameIds.length > 0,
    refetchInterval: 30000,
  });
  const { data: livePlayerStatsByPlayerRows = [] } = useQuery({
    queryKey: ['slip-builder-live-player-stats-by-player', allRelevantPlayerIds.join(',')],
    queryFn: async () => {
      if (!allRelevantPlayerIds.length) {
        return [] as Array<{
          game_id: string;
          nba_player_id: number;
          stats: Record<string, number | null | undefined> | null;
          updated_at: string;
        }>;
      }
      const { data, error } = await supabase
        .from('live_player_stats')
        .select('game_id, nba_player_id, stats, updated_at')
        .in('nba_player_id', allRelevantPlayerIds)
        .order('updated_at', { ascending: false })
        .limit(5000);
      if (error) return [];
      return (data ?? []) as Array<{
        game_id: string;
        nba_player_id: number;
        stats: Record<string, number | null | undefined> | null;
        updated_at: string;
      }>;
    },
    enabled: allRelevantPlayerIds.length > 0,
    refetchInterval: 30000,
  });

  const playerById = useMemo(() => {
    const map = new Map<
      number,
      {
        name: string | null;
        team_abbreviation: string | null;
        position: string | null;
        jersey_number: string | null;
      }
    >();
    playerRows.forEach((p) => map.set(Number(p.nba_player_id), p));
    return map;
  }, [playerRows]);

  const sortedLabel = useMemo(() => {
    if (savedSlipsSort === 'stake') return 'Biggest bet';
    if (savedSlipsSort === 'payout') return 'Biggest payout';
    return 'Most recent';
  }, [savedSlipsSort]);
  const liveStatsByGameAndPlayer = useMemo(() => {
    const map = new Map<
      string,
      { stats: Record<string, number | null | undefined> | null; updated_at: string }
    >();
    livePlayerStatsRows.forEach((row) => {
      if (!row.game_id || row.nba_player_id == null) return;
      map.set(`${row.game_id}:${row.nba_player_id}`, {
        stats: row.stats ?? null,
        updated_at: row.updated_at,
      });
    });
    return map;
  }, [livePlayerStatsRows]);
  const latestLiveStatsByPlayer = useMemo(() => {
    const map = new Map<
      number,
      { game_id: string; stats: Record<string, number | null | undefined> | null; updated_at: string }
    >();
    for (const row of livePlayerStatsByPlayerRows) {
      const playerId = Number(row.nba_player_id);
      if (!Number.isFinite(playerId) || playerId <= 0) continue;
      if (!map.has(playerId)) {
        map.set(playerId, {
          game_id: row.game_id,
          stats: row.stats ?? null,
          updated_at: row.updated_at,
        });
      }
    }
    return map;
  }, [livePlayerStatsByPlayerRows]);

  const handleCreateNewSlip = () => {
    feedRestore?.goToMainDrawerProps();
    navigate('/props', { state: { keepDrawerOpen: true } });
  };

  const handleMessageActiveSlip = () => {
    if (!feedRestore) return;
    const summary = buildSlipShareText({
      stakeCents: stake_cents,
      potentialPayoutCents,
      totalOddsDecimal,
      legs: legs.map((leg) => ({
        player_name: leg.player_name,
        bet_type: leg.bet_type,
        line: leg.line,
        side: leg.side,
      })),
    });
    feedRestore.goToProfileMessages({ text: summary });
  };

  const handleMessageSavedSlip = async (slip: (typeof savedSlips)[number]) => {
    if (!feedRestore) return;
    let shareToken = slip.share_token || '';
    if (!slip.is_shared) {
      try {
        await toggleSlipShare.mutateAsync({ slipId: slip.id, isShared: true });
        await refetchSavedSlips();
      } catch (error) {
        setSaveMessage({ type: 'danger', text: error instanceof Error ? error.message : 'Failed to enable sharing' });
        return;
      }
    }
    if (!shareToken) {
      const { data: row } = await supabase
        .from('user_slips')
        .select('share_token')
        .eq('id', slip.id)
        .maybeSingle();
      shareToken = row?.share_token || '';
    }
    const summary = buildSlipShareText({
      stakeCents: slip.stake_cents,
      potentialPayoutCents: slip.potential_payout_cents,
      totalOddsDecimal: Number(slip.total_odds_decimal),
      legs: (slip.legs || []).map((leg) => ({
        player_name: leg.player_name,
        bet_type: leg.bet_type,
        line: Number(leg.line),
        side: leg.side,
      })),
    });
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const slipUrl = shareToken ? `${origin}/slip/${shareToken}` : '';
    const text = slipUrl ? `${summary}\n${slipUrl}` : summary;
    feedRestore.goToProfileMessages({ text });
  };

  useEffect(() => {
    const el = savedScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
      if (nearBottom && hasMoreSavedSlips && !isFetchingMoreSavedSlips) {
        fetchNextSavedSlips();
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasMoreSavedSlips, isFetchingMoreSavedSlips, fetchNextSavedSlips]);

  const performSave = async () => {
    if (!user || legs.length === 0) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const { data: slip, error: slipError } = await supabase
        .from('user_slips')
        .insert({
          user_id: user.id,
          stake_cents: stake_cents || 0,
          total_odds_decimal: totalOddsDecimal,
          potential_payout_cents: potentialPayoutCents,
          status: 'pending',
          game_date: todayDate,
        })
        .select('id')
        .single();

      if (slipError) throw slipError;
      if (!slip?.id) throw new Error('No slip id returned');

      const legRows = legs.map((leg, i) => ({
        slip_id: slip.id,
        display_order: i,
        player_prop_id: leg.player_prop_id ?? null,
        nba_player_id: leg.nba_player_id,
        player_name: leg.player_name,
        bet_type: leg.bet_type,
        line: leg.line,
        side: leg.side,
        odds_american: leg.odds_american || null,
        odds_decimal: leg.odds_decimal,
        game_id: toUuidOrNull(leg.game_id),
        game_date: todayDate,
      }));

      const { error: legsError } = await supabase.from('slip_legs').insert(legRows);
      if (legsError) throw legsError;

      setSaveMessage({ type: 'success', text: 'Slip saved.' });
      clearSlip();
      setConfirmOpen(false);
      refetchSavedSlips();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save slip';
      setSaveMessage({ type: 'danger', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = () => {
    if (!user) {
      setSaveMessage({ type: 'danger', text: 'Sign in to save slips.' });
      return;
    }
    if (legs.length === 0) {
      setSaveMessage({ type: 'danger', text: 'Add at least one prop.' });
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        position: 'relative',
        bgcolor: '#1a1a1a',
        borderColor: '#333333',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {feedRestore?.restoreSnapshot ? (
        <IconButton
          size="sm"
          variant="plain"
          color="neutral"
          onClick={() => feedRestore.restoreFromSlipBuilder()}
          aria-label="Back to props"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 11,
            color: '#999',
            borderRight: '1px solid',
            borderBottom: '1px solid',
            borderColor: '#333333',
            borderTopLeftRadius: 6,
            bgcolor: '#252525',
          }}
        >
          <ArrowBackIosNewRounded sx={{ fontSize: 18 }} />
        </IconButton>
      ) : null}
      <Box
        sx={{
          position: 'absolute',
          top: 6,
          left: feedRestore?.restoreSnapshot ? 42 : 8,
          zIndex: 10,
        }}
      >
        <Button
          size="sm"
          variant="solid"
          color="primary"
          onClick={handleCreateNewSlip}
          sx={{ minHeight: 26, px: 1 }}
        >
          Create new slip
        </Button>
      </Box>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          px: 1.5,
          py: 0.5,
          borderLeft: '1px solid',
          borderBottom: '1px solid',
          borderColor: '#333333',
          borderTopRightRadius: 6,
          bgcolor: '#252525',
          zIndex: 10,
        }}
      >
        <Typography level="body-xs" sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', color: '#CCCCCC', textTransform: 'uppercase' }}>
          Slip Builder
        </Typography>
      </Box>
      <CardContent
        sx={{
          bgcolor: '#1a1a1a',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          pt: 4.5,
        }}
      >
        {hasActiveSlip ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              p: 1.25,
              border: '1px solid #333333',
              borderRadius: 8,
              bgcolor: '#141414',
            }}
          >
            <Stack spacing={1} sx={{ mb: 1.25, flex: 1, minHeight: 0, overflow: 'auto', pr: 0.25 }}>
              {legs.map((leg: SlipLeg) => {
                const playerMeta = leg.nba_player_id != null ? playerById.get(Number(leg.nba_player_id)) : undefined;
                const playerId = Number(leg.nba_player_id);
                const propsGameId = toUuidOrNull(leg.game_id);
                const nbaGameId = propsGameId ? propsGameIdMap.get(propsGameId) : null;
                const liveStatKey = nbaGameId && Number.isFinite(playerId) && playerId > 0 ? `${nbaGameId}:${playerId}` : null;
                const liveStat = liveStatKey ? liveStatsByGameAndPlayer.get(liveStatKey) : undefined;
                const liveFallback = Number.isFinite(playerId) && playerId > 0 ? latestLiveStatsByPlayer.get(playerId) : undefined;
                const effectiveLive = liveStat ?? liveFallback;
                const liveValue = getLiveValueForBetType(leg.bet_type, effectiveLive?.stats);
                const isOver = leg.side === 'over';
                const liveHit = liveValue != null ? (isOver ? liveValue > Number(leg.line) : liveValue < Number(leg.line)) : null;
                return (
                  <Box
                    key={leg.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      py: 1,
                      px: 1.25,
                      borderRadius: 'sm',
                      bgcolor: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.10)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, minWidth: 0, flex: 1 }}>
                      <Avatar
                        size="md"
                        src={leg.nba_player_id ? `https://cdn.nba.com/headshots/nba/latest/260x190/${leg.nba_player_id}.png` : undefined}
                        alt={leg.player_name}
                        sx={{ width: 38, height: 38, flexShrink: 0 }}
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 700, fontSize: '0.95rem' }} noWrap>
                          {playerMeta?.name || leg.player_name}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: '#9ca3af' }} noWrap>
                          {playerMeta?.team_abbreviation || 'NBA'}
                          {(playerMeta?.jersey_number || playerMeta?.position) ? ' • ' : ''}
                          {playerMeta?.jersey_number ? `#${playerMeta.jersey_number}` : ''}
                          {playerMeta?.jersey_number && playerMeta?.position ? ' • ' : ''}
                          {playerMeta?.position || ''}
                        </Typography>
                        <Typography level="body-sm" sx={{ color: '#f3f4f6', fontWeight: 600, mt: 0.35 }} noWrap>
                          {formatBetType(leg.bet_type)} {leg.line} {leg.side === 'over' ? 'O' : 'U'} {leg.odds_american ? `(${leg.odds_american})` : ''}
                        </Typography>
                        {liveValue != null && (
                          <Typography
                            level="body-xs"
                            sx={{ color: liveHit == null ? '#cbd5e1' : liveHit ? '#4ade80' : '#fda4af', mt: 0.25, fontWeight: 700 }}
                            noWrap
                          >
                            Live {liveValue.toFixed(1)} {effectiveLive?.updated_at ? `· ${dayjs(effectiveLive.updated_at).format('h:mm A')}` : ''}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="neutral"
                      onClick={() => removeLeg(leg.id)}
                      sx={{ color: '#999' }}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Box>
                );
              })}
            </Stack>
            <Box sx={{ mt: 'auto', pt: 1.25, borderTop: '1px solid #333333' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography level="body-sm" sx={{ color: '#CCC' }}>
                  Stake $
                </Typography>
                <Input
                  type="number"
                  size="sm"
                  value={stake_cents / 100}
                  onChange={(e) => setStakeCents(Math.round(parseFloat(e.target.value || '0') * 100))}
                  slotProps={{ input: { min: 0, step: 0.01 } }}
                  sx={{ width: 90, color: '#FFF' }}
                />
              </Box>
              <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 600 }}>
                Total odds: {totalOddsDecimal.toFixed(2)}× → Payout: ${(potentialPayoutCents / 100).toFixed(2)}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 1.25 }}>
                <Button
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  onClick={clearSlip}
                  sx={{ color: '#CCC' }}
                >
                  Clear
                </Button>
                {feedRestore ? (
                  <Button
                    size="sm"
                    variant="outlined"
                    color="primary"
                    onClick={handleMessageActiveSlip}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    Message slip
                  </Button>
                ) : null}
                <Button
                  size="md"
                  variant="solid"
                  color="primary"
                  startDecorator={<Save />}
                  onClick={handleSaveClick}
                  loading={saving}
                  sx={{ flex: 1, minHeight: 42, fontWeight: 700 }}
                >
                  Save slip
                </Button>
              </Stack>
            </Box>
          </Box>
        ) : (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
              <Typography level="body-xs" sx={{ color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Recent slips ({sortedLabel})
              </Typography>
              <Select
                size="sm"
                value={savedSlipsSort}
                onChange={(_, value) => {
                  if (value === 'recent' || value === 'stake' || value === 'payout') {
                    setSavedSlipsSort(value);
                  }
                }}
                sx={{ minWidth: 138, bgcolor: '#111827', color: '#e5e7eb', borderColor: '#374151' }}
              >
                <Option value="recent">Most recent</Option>
                <Option value="stake">Biggest bet</Option>
                <Option value="payout">Biggest payout</Option>
              </Select>
            </Box>

            <Box ref={savedScrollRef} sx={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #333333', borderRadius: 8 }}>
              {savedSlipsLoading ? (
                <Box sx={{ p: 2 }}>
                  <Typography level="body-sm" sx={{ color: '#999' }}>Loading saved slips...</Typography>
                </Box>
              ) : !hasSavedSlips ? (
                <Box sx={{ p: 2 }}>
                  <Typography level="body-sm" sx={{ color: '#999' }}>No saved slips yet.</Typography>
                </Box>
              ) : (
                <Stack spacing={1} sx={{ p: 1 }}>
                  {savedSlips.map((slip) => (
                    <Card key={slip.id} variant="soft" sx={{ bgcolor: '#111827', border: '1px solid #374151' }}>
                      <CardContent sx={{ p: 1.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography level="body-xs" sx={{ color: '#9ca3af' }}>
                              {dayjs(slip.created_at).format('MMM D, h:mm A')}
                            </Typography>
                            <Typography level="title-sm" sx={{ color: '#f3f4f6', mt: 0.25 }}>
                              {(slip.legs?.length ?? 0)} leg{(slip.legs?.length ?? 0) === 1 ? '' : 's'} · {slip.status.replace('_', ' ')}
                            </Typography>
                          </Box>
                          <Button
                            size="sm"
                            variant="outlined"
                            color="neutral"
                            loading={toggleSlipShare.isPending}
                            onClick={() => toggleSlipShare.mutate({ slipId: slip.id, isShared: !slip.is_shared })}
                            sx={{ color: '#d1d5db', borderColor: '#4b5563', whiteSpace: 'nowrap' }}
                          >
                            {slip.is_shared ? 'Stop sharing' : 'Public link'}
                          </Button>
                          {feedRestore ? (
                            <Button
                              size="sm"
                              variant="solid"
                              color="primary"
                              onClick={() => handleMessageSavedSlip(slip)}
                              loading={toggleSlipShare.isPending}
                              sx={{ whiteSpace: 'nowrap' }}
                            >
                              Message slip
                            </Button>
                          ) : null}
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.75, mt: 1 }}>
                          <Box sx={{ p: 0.75, borderRadius: 6, bgcolor: '#0b1220', border: '1px solid #223047' }}>
                            <Typography level="body-xs" sx={{ color: '#9ca3af' }}>Stake</Typography>
                            <Typography level="body-sm" sx={{ color: '#e5e7eb', fontWeight: 700 }}>${(slip.stake_cents / 100).toFixed(2)}</Typography>
                          </Box>
                          <Box sx={{ p: 0.75, borderRadius: 6, bgcolor: '#0b1220', border: '1px solid #223047' }}>
                            <Typography level="body-xs" sx={{ color: '#9ca3af' }}>Payout</Typography>
                            <Typography level="body-sm" sx={{ color: '#facc15', fontWeight: 700 }}>${(slip.potential_payout_cents / 100).toFixed(2)}</Typography>
                          </Box>
                          <Box sx={{ p: 0.75, borderRadius: 6, bgcolor: '#0b1220', border: '1px solid #223047' }}>
                            <Typography level="body-xs" sx={{ color: '#9ca3af' }}>Odds</Typography>
                            <Typography level="body-sm" sx={{ color: '#e5e7eb', fontWeight: 700 }}>{Number(slip.total_odds_decimal).toFixed(2)}x</Typography>
                          </Box>
                        </Box>

                        <Stack spacing={0.75} sx={{ mt: 1.1 }}>
                          {(slip.legs || []).map((leg, idx) => {
                            const playerId = Number(leg.nba_player_id);
                            const playerMeta = Number.isFinite(playerId) && playerId > 0 ? playerById.get(playerId) : undefined;
                            const gameId = toUuidOrNull(leg.game_id);
                            const nbaGameId = gameId ? propsGameIdMap.get(gameId) : null;
                            const liveStatKey = nbaGameId && Number.isFinite(playerId) && playerId > 0 ? `${nbaGameId}:${playerId}` : null;
                            const liveStat = liveStatKey ? liveStatsByGameAndPlayer.get(liveStatKey) : undefined;
                            const liveFallback = Number.isFinite(playerId) && playerId > 0 ? latestLiveStatsByPlayer.get(playerId) : undefined;
                            const effectiveLive = liveStat ?? liveFallback;
                            const liveValue = getLiveValueForBetType(leg.bet_type, effectiveLive?.stats);
                            const isOver = leg.side === 'over';
                            const hit = liveValue != null ? (isOver ? liveValue > Number(leg.line) : liveValue < Number(leg.line)) : null;
                            return (
                              <Box
                                key={`${slip.id}-${idx}`}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 1,
                                  py: 0.7,
                                  px: 0.85,
                                  borderRadius: 6,
                                  border: '1px solid #334155',
                                  bgcolor: '#0f172a',
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9, minWidth: 0, flex: 1 }}>
                                  <Avatar
                                    size="sm"
                                    src={Number.isFinite(playerId) && playerId > 0 ? `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png` : undefined}
                                    alt={leg.player_name}
                                    sx={{ width: 32, height: 32, flexShrink: 0 }}
                                  />
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography level="body-sm" sx={{ color: '#f8fafc', fontWeight: 700 }} noWrap>
                                      {playerMeta?.name || leg.player_name}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: '#94a3b8' }} noWrap>
                                      {formatBetType(leg.bet_type)} {leg.line} {isOver ? 'O' : 'U'} {leg.odds_american ? `(${leg.odds_american})` : ''}
                                    </Typography>
                                  </Box>
                                </Box>
                                {liveValue != null && (
                                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                                    <Typography
                                      level="body-xs"
                                      sx={{ color: hit == null ? '#cbd5e1' : hit ? '#4ade80' : '#fda4af', fontWeight: 700 }}
                                    >
                                      Live: {liveValue.toFixed(1)}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: '#64748b' }}>
                                      {effectiveLive?.updated_at ? dayjs(effectiveLive.updated_at).format('h:mm A') : ''}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                            );
                          })}
                        </Stack>
                        {slip.is_shared && slip.share_token ? (
                          <Typography level="body-xs" sx={{ mt: 1, color: '#9ca3af', wordBreak: 'break-all' }}>
                            {typeof window !== 'undefined' ? `${window.location.origin}/slip/${slip.share_token}` : ''}
                          </Typography>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
              <Box sx={{ p: 1.25, borderTop: '1px solid #333333', textAlign: 'center' }}>
                {isFetchingMoreSavedSlips ? (
                  <Typography level="body-xs" sx={{ color: '#9ca3af' }}>Loading more...</Typography>
                ) : hasMoreSavedSlips ? (
                  <Typography level="body-xs" sx={{ color: '#9ca3af' }}>Scroll for more</Typography>
                ) : (
                  <Typography level="body-xs" sx={{ color: '#6b7280' }}>End of slips</Typography>
                )}
              </Box>
            </Box>
          </>
        )}

        {saveMessage && (
          <Alert color={saveMessage.type} size="sm" sx={{ mt: 1.5 }}>
            {saveMessage.text}
          </Alert>
        )}
      </CardContent>

      <Modal open={confirmOpen} onClose={() => !saving && setConfirmOpen(false)}>
        <ModalDialog sx={{ bgcolor: '#1a1a1a', borderColor: '#333' }}>
          <ModalClose disabled={saving} />
          <Typography level="title-md" sx={{ color: '#FFF', mb: 1 }}>
            Finish this slip?
          </Typography>
          <Typography level="body-sm" sx={{ color: '#CCC', mb: 1 }}>
            {legs.length} leg{legs.length !== 1 ? 's' : ''} · {totalOddsDecimal.toFixed(2)}× · Stake ${(stake_cents / 100).toFixed(2)} → Payout ${(potentialPayoutCents / 100).toFixed(2)}
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button variant="outlined" color="neutral" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="solid" color="primary" startDecorator={<Save />} onClick={performSave} loading={saving}>
              Yes, save slip
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </Card>
  );
}
