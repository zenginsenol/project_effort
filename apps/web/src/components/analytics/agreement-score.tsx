'use client';

interface AgreementScoreProps {
  score: number;
  description?: string;
}

export function AgreementScore({
  score,
  description = 'Method agreement indicates how closely different estimation methods converged',
}: AgreementScoreProps): React.ReactElement {
  // Clamp score between 0 and 100
  const clampedScore = Math.max(0, Math.min(100, score));

  // Determine confidence level and colors
  function getConfidenceLevel(): {
    label: string;
    color: string;
    bgColor: string;
    textColor: string;
  } {
    if (clampedScore >= 80) {
      return {
        label: 'High Agreement',
        color: 'bg-green-500',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
      };
    }
    if (clampedScore >= 60) {
      return {
        label: 'Moderate Agreement',
        color: 'bg-yellow-500',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
      };
    }
    return {
      label: 'Low Agreement',
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
    };
  }

  const confidence = getConfidenceLevel();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Method Agreement Score</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        {/* Score Display */}
        <div className="text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <p className="text-5xl font-bold text-primary">
              {Math.round(clampedScore)}
            </p>
            <p className="text-2xl text-muted-foreground">%</p>
          </div>
          <div
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${confidence.bgColor} ${confidence.textColor}`}
          >
            {confidence.label}
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-6">
          <div className="relative h-4 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-500 ${confidence.color}`}
              style={{ width: `${clampedScore}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Interpretation Guide */}
        <div className="mt-6 space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Interpretation:</p>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>
                <strong className="text-green-700">80-100%:</strong> Methods
                strongly agree - high confidence in estimates
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
              <span>
                <strong className="text-yellow-700">60-79%:</strong> Moderate
                agreement - consider averaging methods
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span>
                <strong className="text-red-700">&lt;60%:</strong> Low
                agreement - review assumptions or use conservative estimates
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
