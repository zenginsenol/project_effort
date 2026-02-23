'use client';

import { Check, Eye, EyeOff, Loader2, RotateCcw, Users, WifiOff } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PresenceIndicator } from '@/components/presence-indicator';
import { useSocket } from '@/hooks/use-socket';
import { getApiBaseUrl } from '@/lib/api-url';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

import type { PresenceStatus } from '@/components/presence-indicator';

const FIBONACCI_CARDS = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const TSHIRT_CARDS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function getDisplayName(member: {
  user: { firstName: string | null; lastName: string | null; email: string } | null;
}): string {
  if (!member.user) {
    return 'Unknown';
  }
  const firstName = member.user.firstName?.trim() ?? '';
  const lastName = member.user.lastName?.trim() ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || member.user.email;
}

function calculateVoteMetrics(votes: string[]): {
  average: string;
  median: string;
  consensus: string;
  agreement: string;
} {
  if (votes.length === 0) {
    return { average: '-', median: '-', consensus: '-', agreement: '0%' };
  }

  const frequency = new Map<string, number>();
  for (const vote of votes) {
    frequency.set(vote, (frequency.get(vote) ?? 0) + 1);
  }

  const consensusEntry = [...frequency.entries()].sort((a, b) => b[1] - a[1])[0];
  const consensus = consensusEntry?.[0] ?? '-';
  const agreement = consensusEntry ? `${Math.round((consensusEntry[1] / votes.length) * 100)}%` : '0%';

  const numericVotes = votes
    .map((vote) => Number(vote))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (numericVotes.length === 0) {
    return { average: '-', median: '-', consensus, agreement };
  }

  const average = (numericVotes.reduce((sum, value) => sum + value, 0) / numericVotes.length).toFixed(2);
  const mid = Math.floor(numericVotes.length / 2);
  const left = numericVotes[mid - 1] ?? numericVotes[mid] ?? 0;
  const right = numericVotes[mid] ?? left;
  const median = numericVotes.length % 2 === 0
    ? ((left + right) / 2).toFixed(2)
    : numericVotes[mid]?.toFixed(2) ?? '-';

  return { average, median, consensus, agreement };
}

export default function SessionDetailPage(): React.ReactElement {
  const utils = trpc.useUtils();
  const params = useParams<{ sessionId: string }>();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;

  const hasJoinedRef = useRef(false);

  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [finalEstimate, setFinalEstimate] = useState('');

  const sessionQuery = trpc.session.getById.useQuery({ id: sessionId }, { retry: false });

  const orgId = sessionQuery.data?.project?.organizationId ?? '';
  const meQuery = trpc.team.me.useQuery(
    undefined,
    { enabled: Boolean(orgId), retry: false },
  );

  const currentUserId = meQuery.data?.userId ?? null;
  const currentRound = sessionQuery.data?.currentRound ?? 1;

  const votesQuery = trpc.session.getVotes.useQuery(
    { id: sessionId, round: currentRound },
    { enabled: Boolean(sessionQuery.data), retry: false },
  );

  const { socket, error: socketError, isConnected, isConnecting, reconnectAttempt } = useSocket({
    url: getApiBaseUrl(),
    path: '/ws',
    auth:
      currentUserId && orgId
        ? {
            userId: currentUserId,
            orgId,
          }
        : undefined,
    autoConnect: Boolean(currentUserId && orgId),
    reconnection: true,
  });

  const joinMutation = trpc.session.join.useMutation({
    onSuccess: async () => {
      await utils.session.getById.invalidate({ id: sessionId });
    },
  });

  const voteMutation = trpc.session.vote.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.session.getVotes.invalidate(),
        utils.session.getById.invalidate({ id: sessionId }),
      ]);
    },
  });

  const revealMutation = trpc.session.reveal.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.session.getVotes.invalidate(),
        utils.session.getById.invalidate({ id: sessionId }),
      ]);
    },
  });

  const newRoundMutation = trpc.session.newRound.useMutation({
    onSuccess: async () => {
      setSelectedCard(null);
      await Promise.all([
        utils.session.getVotes.invalidate(),
        utils.session.getById.invalidate({ id: sessionId }),
      ]);
    },
  });

  const completeMutation = trpc.session.complete.useMutation({
    onSuccess: async () => {
      await utils.session.getById.invalidate({ id: sessionId });
    },
  });

  useEffect(() => {
    if (!currentUserId || hasJoinedRef.current) {
      return;
    }
    hasJoinedRef.current = true;
    joinMutation.mutate({ sessionId, userId: currentUserId });
  }, [currentUserId, joinMutation, sessionId]);

  useEffect(() => {
    if (!socket || !currentUserId) {
      return;
    }

    const refreshSessionState = (): void => {
      void Promise.all([
        utils.session.getById.invalidate({ id: sessionId }),
        utils.session.getVotes.invalidate(),
      ]);
    };

    socket.emit('join-session', { sessionId, userId: currentUserId });

    socket.on('session-error', (error: { message?: string }) => {
      // Session-specific errors are handled through the error state
    });
    socket.on('participant-joined', refreshSessionState);
    socket.on('participant-left', refreshSessionState);
    socket.on('vote-submitted', refreshSessionState);
    socket.on('votes-revealed', refreshSessionState);
    socket.on('new-round-started', refreshSessionState);

    return () => {
      socket.emit('leave-session', { sessionId, userId: currentUserId });
      socket.off('session-error');
      socket.off('participant-joined');
      socket.off('participant-left');
      socket.off('vote-submitted');
      socket.off('votes-revealed');
      socket.off('new-round-started');
    };
  }, [socket, currentUserId, sessionId, utils.session.getById, utils.session.getVotes]);

  const cards = useMemo(() => {
    if (sessionQuery.data?.method === 'planning_poker') {
      return FIBONACCI_CARDS.map(String);
    }
    if (sessionQuery.data?.method === 'tshirt_sizing') {
      return TSHIRT_CARDS;
    }
    return FIBONACCI_CARDS.map(String);
  }, [sessionQuery.data?.method]);

  const voteByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const vote of votesQuery.data ?? []) {
      map.set(vote.userId, vote.value);
    }
    return map;
  }, [votesQuery.data]);

  const participants = sessionQuery.data?.participants ?? [];
  const isRevealed = sessionQuery.data?.status === 'revealed' || sessionQuery.data?.status === 'completed';

  const metrics = useMemo(() => {
    const votes = [...voteByUserId.values()];
    return calculateVoteMetrics(votes);
  }, [voteByUserId]);

  async function handleVote(card: string): Promise<void> {
    if (!currentUserId || !sessionQuery.data || isRevealed) {
      return;
    }

    const nextCard = selectedCard === card ? null : card;
    setSelectedCard(nextCard);
    if (!nextCard) {
      return;
    }

    await voteMutation.mutateAsync({
      sessionId,
      userId: currentUserId,
      round: sessionQuery.data.currentRound,
      value: nextCard,
    });

    socket?.emit('submit-vote', { sessionId, userId: currentUserId, value: nextCard });
  }

  async function handleReveal(): Promise<void> {
    await revealMutation.mutateAsync({ sessionId });
    socket?.emit('reveal-votes', { sessionId });
  }

  async function handleNewRound(): Promise<void> {
    const nextRound = (sessionQuery.data?.currentRound ?? 1) + 1;
    await newRoundMutation.mutateAsync({ sessionId });
    socket?.emit('start-new-round', { sessionId, round: nextRound });
  }

  async function handleComplete(): Promise<void> {
    const parsed = Number(finalEstimate);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return;
    }

    await completeMutation.mutateAsync({ sessionId, finalEstimate: parsed });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{sessionQuery.data?.name ?? 'Session'}</h1>
          <p className="text-sm text-muted-foreground">Session: {sessionId}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
            <Users className="h-3 w-3" />
            {participants.length} participants
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
            Round {currentRound}
          </span>
        </div>
      </div>

      {isConnecting && (
        <div className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              Reconnecting...
              {reconnectAttempt > 0 && ` (attempt ${reconnectAttempt})`}
            </span>
          </div>
        </div>
      )}

      {!isConnected && !isConnecting && currentUserId && orgId && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4" />
            <span>Disconnected from real-time updates</span>
          </div>
        </div>
      )}

      {socketError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
          Connection error: {socketError}
        </div>
      )}

      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-medium">Project: {sessionQuery.data?.project?.name ?? '-'}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Method: {sessionQuery.data?.method ?? '-'}
          {sessionQuery.data?.task ? ` • Task: ${sessionQuery.data.task.title}` : ''}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Participants</h3>
        <div className="flex flex-wrap gap-3">
          {participants.map((participant: typeof participants[number]) => {
            const vote = voteByUserId.get(participant.userId) ?? null;
            const hasVoted = Boolean(vote);
            const presenceStatus: PresenceStatus = hasVoted && !isRevealed ? 'voting' : 'online';
            return (
              <div key={participant.id} className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'flex h-16 w-12 items-center justify-center rounded-lg border-2 text-sm font-bold transition-all',
                    isRevealed && vote
                      ? 'border-primary bg-primary/10 text-primary'
                      : hasVoted
                        ? 'border-green-500 bg-green-50 dark:bg-green-950'
                        : 'border-muted bg-muted/50',
                  )}
                >
                  {isRevealed ? (vote ?? '-') : hasVoted ? <Check className="h-4 w-4 text-green-500" /> : '?'}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="max-w-20 truncate text-xs text-muted-foreground">
                    {getDisplayName(participant)}
                  </span>
                  <PresenceIndicator status={presenceStatus} size="sm" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Your Vote</h3>
        <div className="flex flex-wrap gap-2">
          {cards.map((card) => (
            <button
              key={card}
              onClick={() => { void handleVote(card); }}
              disabled={isRevealed || voteMutation.isPending}
              className={cn(
                'flex h-20 w-14 items-center justify-center rounded-lg border-2 text-lg font-bold transition-all hover:scale-105',
                card === selectedCard
                  ? 'border-primary bg-primary text-primary-foreground scale-110 shadow-lg'
                  : 'border-muted bg-card hover:border-primary/50',
                (isRevealed || voteMutation.isPending) && 'cursor-not-allowed opacity-50',
              )}
            >
              {card}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t pt-4">
        <button
          onClick={() => { void handleReveal(); }}
          disabled={revealMutation.isPending || sessionQuery.data?.status === 'completed'}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {isRevealed ? 'Reveal Again' : 'Reveal Votes'}
        </button>

        <button
          onClick={() => { void handleNewRound(); }}
          disabled={newRoundMutation.isPending || sessionQuery.data?.status === 'completed'}
          className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          New Round
        </button>

        {isRevealed && sessionQuery.data?.status !== 'completed' && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={finalEstimate}
              onChange={(event) => setFinalEstimate(event.target.value)}
              placeholder="Final estimate"
              className="w-32 rounded-md border px-3 py-2 text-sm"
            />
            <button
              onClick={() => { void handleComplete(); }}
              disabled={completeMutation.isPending || !finalEstimate}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Complete
            </button>
          </div>
        )}
      </div>

      {isRevealed && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Results</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{metrics.average}</p>
              <p className="text-xs text-muted-foreground">Average</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.median}</p>
              <p className="text-xs text-muted-foreground">Median</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.consensus}</p>
              <p className="text-xs text-muted-foreground">Consensus</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{metrics.agreement}</p>
              <p className="text-xs text-muted-foreground">Agreement</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
