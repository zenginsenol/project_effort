'use client';

import { useState } from 'react';
import { Bot, Check, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';

import { cn } from '@/lib/utils';

interface AISuggestion {
  suggestedPoints: number | null;
  suggestedHours: number | null;
  confidence: number;
  reasoning: string;
  similarTasks: Array<{
    taskId: string;
    title: string;
    similarity: number;
    estimatedPoints: number | null;
    estimatedHours: number | null;
  }>;
}

interface SuggestionCardProps {
  suggestion: AISuggestion | null;
  isLoading?: boolean;
  onAccept?: (points: number, hours: number) => void;
  onReject?: () => void;
}

export function SuggestionCard({ suggestion, isLoading, onAccept, onReject }: SuggestionCardProps): React.ReactElement {
  const [showDetails, setShowDetails] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-4 w-4 animate-pulse text-primary" />
          </div>
          <div className="flex-1">
            <div className="h-4 w-32 animate-pulse rounded bg-primary/10" />
            <div className="mt-2 h-3 w-48 animate-pulse rounded bg-primary/10" />
          </div>
        </div>
      </div>
    );
  }

  if (!suggestion) return <></>;

  const confidenceColor = suggestion.confidence >= 0.7
    ? 'text-green-600'
    : suggestion.confidence >= 0.4
      ? 'text-yellow-600'
      : 'text-red-600';

  const confidenceLabel = suggestion.confidence >= 0.7
    ? 'High'
    : suggestion.confidence >= 0.4
      ? 'Medium'
      : 'Low';

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">AI Estimation Suggestion</h4>
            <p className={cn('text-xs', confidenceColor)}>
              {confidenceLabel} confidence ({Math.round(suggestion.confidence * 100)}%)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {suggestion.suggestedPoints !== null && onAccept && (
            <button
              onClick={() => onAccept(suggestion.suggestedPoints ?? 0, suggestion.suggestedHours ?? 0)}
              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              <Check className="h-3 w-3" />
              Accept
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <X className="h-3 w-3" />
              Dismiss
            </button>
          )}
        </div>
      </div>

      {/* Estimation Values */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-md bg-background p-3 text-center">
          <p className="text-2xl font-bold text-primary">{suggestion.suggestedPoints ?? '-'}</p>
          <p className="text-xs text-muted-foreground">Story Points</p>
        </div>
        <div className="rounded-md bg-background p-3 text-center">
          <p className="text-2xl font-bold">{suggestion.suggestedHours ?? '-'}</p>
          <p className="text-xs text-muted-foreground">Hours</p>
        </div>
      </div>

      {/* Reasoning */}
      <p className="mt-3 text-sm text-muted-foreground">{suggestion.reasoning}</p>

      {/* Expandable Similar Tasks */}
      {suggestion.similarTasks.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {suggestion.similarTasks.length} similar tasks found
          </button>

          {showDetails && (
            <div className="mt-2 space-y-2">
              {suggestion.similarTasks.map((task) => (
                <div key={task.taskId} className="flex items-center justify-between rounded-md bg-background p-2 text-xs">
                  <span className="truncate font-medium">{task.title}</span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{task.estimatedPoints ?? '-'} pts</span>
                    <span className="text-primary">{Math.round(task.similarity * 100)}% match</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
