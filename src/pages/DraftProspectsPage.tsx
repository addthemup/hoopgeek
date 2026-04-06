import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Favorite, DragIndicator, ArrowUpward, ArrowDownward, Remove } from '@mui/icons-material';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '../hooks/useAuth';
import { useDraftProspectRankings, type DraftProspectWithRanking } from '../hooks/useDraftProspectRankings';
import {
  useDraftUserAggregate,
  useDraftUserRankings,
  useUpsertDraftUserRanking,
} from '../hooks/useDraftUserRankings';
import { useProspectFavorites } from '../hooks/useProspectFavorites';
import DraftTrendModule from '../components/Feed/DraftTrendModule';

type DraftTab = 'big_board' | 'my_board';

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}

export default function DraftProspectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<DraftTab>('big_board');
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [myBoardOrder, setMyBoardOrder] = useState<string[]>([]);
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: prospects, isLoading } = useDraftProspectRankings({ includeUnranked: true });
  const { data: favoriteProspects } = useProspectFavorites();
  const favoriteIds = new Set((favoriteProspects ?? []).map((p) => p.draft_prospect_id));

  const activeDraftYear = useMemo(() => {
    if (!prospects?.length) return null;
    return prospects.reduce((acc, p) => Math.max(acc, p.draft_year ?? 0), 0) || null;
  }, [prospects]);

  const { data: userRankings } = useDraftUserRankings(activeDraftYear);
  const { data: userAggregates } = useDraftUserAggregate(activeDraftYear);
  const upsertUserRanking = useUpsertDraftUserRanking();

  const userRankByProspect = useMemo(
    () => new Map((userRankings ?? []).map((r) => [r.draft_prospect_id, r.rank])),
    [userRankings]
  );

  const userAggregateByProspect = useMemo(
    () => new Map((userAggregates ?? []).map((r) => [r.draft_prospect_id, r])),
    [userAggregates]
  );

  const prospectById = useMemo(() => new Map((prospects ?? []).map((p) => [p.id, p])), [prospects]);

  useEffect(() => {
    if (!prospects?.length) return;
    const ids = [...prospects]
      .sort((a, b) => {
        const ar = userRankByProspect.get(a.id) ?? 9999;
        const br = userRankByProspect.get(b.id) ?? 9999;
        if (ar !== br) return ar - br;
        const acr = a.consensus_rank ?? 9999;
        const bcr = b.consensus_rank ?? 9999;
        if (acr !== bcr) return acr - bcr;
        return a.player_name_full.localeCompare(b.player_name_full);
      })
      .map((p) => p.id);
    setMyBoardOrder(ids);
  }, [prospects, userRankByProspect]);

  useEffect(() => {
    if (!prospects?.length) return;
    setSelectedProspectId((prev) => prev ?? prospects[0].id);
  }, [prospects]);

  useEffect(() => {
    if (tab === 'my_board' && !user) {
      setTab('big_board');
    }
  }, [tab, user]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const boardProspects = useMemo(
    () => myBoardOrder.map((id) => prospectById.get(id)).filter((p): p is DraftProspectWithRanking => !!p),
    [myBoardOrder, prospectById]
  );

  const handleMyBoardDragEnd = async (event: DragEndEvent) => {
    if (!user || !activeDraftYear) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = myBoardOrder.indexOf(active.id as string);
    const newIndex = myBoardOrder.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(myBoardOrder, oldIndex, newIndex);
    setMyBoardOrder(reordered);

    const start = Math.min(oldIndex, newIndex);
    const end = Math.max(oldIndex, newIndex);
    const affectedIds = reordered.slice(start, end + 1);

    setSaveError(null);
    try {
      await Promise.all(
        affectedIds.map((id, idx) =>
          upsertUserRanking.mutateAsync({
            draftProspectId: id,
            draftYear: activeDraftYear,
            rank: start + idx + 1,
          })
        )
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save your board order.');
    }
  };

  return (
    <div className="w-full min-w-0 overflow-x-hidden pt-2 pb-6 text-zinc-100 md:pt-3">
      {isLoading ? (
        <Card className="border-zinc-700 bg-zinc-900 text-zinc-100">
          <CardContent className="p-6 text-sm text-zinc-400">Loading draft board...</CardContent>
        </Card>
      ) : !prospects?.length ? (
        <Card className="border-zinc-700 bg-zinc-900 text-zinc-100">
          <CardContent className="p-6 text-sm text-zinc-400">No prospects yet.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <Card className="border-zinc-700 bg-zinc-900 text-zinc-100">
            <CardHeader className="pb-2">
              <div className="flex w-full items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 p-1 text-zinc-100">
                <Button
                  variant={tab === 'big_board' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => setTab('big_board')}
                >
                  Big Board
                </Button>
                <Button
                  variant={tab === 'my_board' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => user && setTab('my_board')}
                  disabled={!user}
                >
                  My Board
                </Button>
              </div>
              <CardTitle className="text-zinc-100">
                {tab === 'big_board' ? 'Consensus + Movement' : 'My Board + Movement'}
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Tap a row to expand movement history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tab === 'big_board' &&
                (prospects ?? []).map((p) => (
                  <ProspectRow
                    key={p.id}
                    prospect={p}
                    selected={selectedProspectId === p.id}
                    trendOpen={expandedTrendId === p.id}
                    draftYear={activeDraftYear}
                    isFavorite={favoriteIds.has(p.id)}
                    aggregateLabel={
                      p.aggregate_rank_avg != null ? `Stock ${p.aggregate_rank_avg.toFixed(1)}` : null
                    }
                    userAggregateLabel={
                      userAggregateByProspect.get(p.id)
                        ? `User ${userAggregateByProspect.get(p.id)!.user_rank_avg.toFixed(1)}`
                        : null
                    }
                    onSelect={() => setSelectedProspectId(p.id)}
                    onToggleTrend={() => {
                      setSelectedProspectId(p.id);
                      setExpandedTrendId((prev) => (prev === p.id ? null : p.id));
                    }}
                    onOpenProspect={() => navigate(`/prospect/${p.id}`)}
                  />
                ))}

              {tab === 'my_board' && user && (
                <>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMyBoardDragEnd}>
                    <SortableContext items={boardProspects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                      {boardProspects.map((p, index) => (
                        <MyBoardRow
                          key={p.id}
                          id={p.id}
                          index={index}
                          prospect={p}
                          selected={selectedProspectId === p.id}
                          trendOpen={expandedTrendId === p.id}
                          draftYear={activeDraftYear}
                          myRank={userRankByProspect.get(p.id) ?? null}
                          isFavorite={favoriteIds.has(p.id)}
                          onSelect={() => setSelectedProspectId(p.id)}
                          onToggleTrend={() => {
                            setSelectedProspectId(p.id);
                            setExpandedTrendId((prev) => (prev === p.id ? null : p.id));
                          }}
                          onOpenProspect={() => navigate(`/prospect/${p.id}`)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  {upsertUserRanking.isPending && <div className="text-xs text-zinc-400">Saving board order...</div>}
                  {saveError && <div className="text-xs text-red-400">{saveError}</div>}
                </>
              )}

              {tab === 'my_board' && !user && (
                <div className="rounded-md border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">
                  Sign in to build and track your own draft board.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'my_board' && !user && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-zinc-700 p-3 text-sm text-zinc-400">
          <Heart className="h-4 w-4" />
          Sign in to save and track your rankings.
        </div>
      )}
    </div>
  );
}

function MovementBadge({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) {
    return (
      <Badge variant="outline" className="border-zinc-700 text-xs text-zinc-400">
        <Remove sx={{ fontSize: 12 }} />
      </Badge>
    );
  }
  if (delta > 0) {
    return (
      <Badge variant="outline" className="border-emerald-700 text-xs text-emerald-300">
        <ArrowUpward sx={{ fontSize: 12 }} />
        +{delta}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-rose-700 text-xs text-rose-300">
      <ArrowDownward sx={{ fontSize: 12 }} />
      {Math.abs(delta)}
    </Badge>
  );
}

function ProspectRow({
  prospect,
  selected,
  isFavorite,
  aggregateLabel,
  userAggregateLabel,
  trendOpen,
  draftYear,
  onSelect,
  onToggleTrend,
  onOpenProspect,
}: {
  prospect: DraftProspectWithRanking;
  selected: boolean;
  isFavorite: boolean;
  aggregateLabel: string | null;
  userAggregateLabel: string | null;
  trendOpen: boolean;
  draftYear?: number | null;
  onSelect: () => void;
  onToggleTrend: () => void;
  onOpenProspect: () => void;
}) {
  return (
    <div className={`rounded-md border px-2.5 py-2 ${selected ? 'border-amber-500/60 bg-zinc-800/60' : 'border-zinc-700 bg-zinc-950'}`}>
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <div className="w-7 text-sm font-semibold text-zinc-300">{prospect.consensus_rank ?? '—'}</div>
          <Avatar className="h-10 w-10">
            <AvatarImage src={prospect.image_url ?? undefined} alt={prospect.player_name_full} />
            <AvatarFallback className="text-xs text-zinc-100">{initials(prospect.player_name_full)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-zinc-100">{prospect.player_name_full}</div>
            <div className="truncate text-xs text-zinc-400">
              {prospect.school_team || '—'} • {prospect.position_primary || 'N/A'}
            </div>
          </div>
        </button>
        <MovementBadge delta={prospect.rank_delta} />
      </div>
      <div className="mt-2 flex items-center gap-1.5 pl-9">
        {aggregateLabel && <Badge variant="outline" className="border-zinc-700 text-[11px] text-zinc-300">{aggregateLabel}</Badge>}
        {userAggregateLabel && <Badge variant="outline" className="border-zinc-700 text-[11px] text-zinc-300">{userAggregateLabel}</Badge>}
        {isFavorite && <Favorite sx={{ fontSize: 16, color: '#dc2626' }} />}
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-zinc-300" onClick={onToggleTrend}>
          {trendOpen ? 'Hide Trend' : 'Trend'}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs text-zinc-300" onClick={onOpenProspect}>
          Profile
        </Button>
      </div>
      {trendOpen && (
        <div className="mt-2 rounded-md border border-zinc-700 bg-zinc-900 p-2">
          <DraftTrendModule prospectId={prospect.id} draftYear={draftYear} />
        </div>
      )}
    </div>
  );
}

function MyBoardRow({
  id,
  index,
  prospect,
  selected,
  trendOpen,
  draftYear,
  myRank,
  isFavorite,
  onSelect,
  onToggleTrend,
  onOpenProspect,
}: {
  id: string;
  index: number;
  prospect: DraftProspectWithRanking;
  selected: boolean;
  trendOpen: boolean;
  draftYear?: number | null;
  myRank: number | null;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleTrend: () => void;
  onOpenProspect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={`rounded-md border px-2.5 py-2 ${selected ? 'border-amber-500/60 bg-zinc-800/60' : 'border-zinc-700 bg-zinc-950'}`}>
      <div className="flex min-h-16 items-center gap-2.5">
        <button
          type="button"
          className="flex h-9 w-8 items-center justify-center text-zinc-500"
          {...attributes}
          {...listeners}
          aria-label="Drag row"
          style={{ touchAction: 'none' }}
        >
          <DragIndicator sx={{ fontSize: 20 }} />
        </button>
        <div className="w-7 text-sm font-semibold text-zinc-300">{myRank ?? index + 1}</div>
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <Avatar className="h-10 w-10">
            <AvatarImage src={prospect.image_url ?? undefined} alt={prospect.player_name_full} />
            <AvatarFallback className="text-xs text-zinc-100">{initials(prospect.player_name_full)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-100">{prospect.player_name_full}</div>
            <div className="truncate text-xs text-zinc-400">
              {prospect.school_team || '—'} • {prospect.position_primary || 'N/A'} • {prospect.draft_year}
            </div>
          </div>
        </button>
        {isFavorite && <Favorite sx={{ fontSize: 16, color: '#dc2626' }} />}
      </div>
      <div className="mt-2 flex items-center gap-1.5 pl-9">
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-zinc-300" onClick={onToggleTrend}>
          {trendOpen ? 'Hide Trend' : 'Trend'}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-zinc-300" onClick={onOpenProspect}>
          Profile
        </Button>
      </div>
      {trendOpen && (
        <div className="mt-2 rounded-md border border-zinc-700 bg-zinc-900 p-2">
          <DraftTrendModule prospectId={prospect.id} draftYear={draftYear} />
        </div>
      )}
    </div>
  );
}
