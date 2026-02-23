'use client';

import { CheckCircle2, Circle, Loader2, PlayCircle, SkipForward } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { trpc } from '@/lib/trpc';

type OnboardingStep = 'organization_created' | 'project_setup' | 'tasks_created' | 'first_estimation';

const STEPS: Array<{ key: OnboardingStep; title: string; description: string; href: string }> = [
  {
    key: 'organization_created',
    title: 'Create your organization',
    description: 'Set up your team workspace to start collaborating.',
    href: '/dashboard/settings/organization',
  },
  {
    key: 'project_setup',
    title: 'Set up a project',
    description: 'Create your first project and define its estimation method.',
    href: '/dashboard/projects',
  },
  {
    key: 'tasks_created',
    title: 'Add tasks',
    description: 'Add tasks to your project backlog to start estimating.',
    href: '/dashboard/projects',
  },
  {
    key: 'first_estimation',
    title: 'Run your first estimation session',
    description: 'Invite your team and estimate tasks together in real time.',
    href: '/dashboard/sessions',
  },
];

export default function OnboardingPage(): React.ReactElement {
  const router = useRouter();
  const utils = trpc.useUtils();

  const orgsQuery = trpc.organization.list.useQuery(undefined, { retry: false });
  const orgId = orgsQuery.data?.[0]?.id ?? '';

  const stateQuery = trpc.onboarding.getState.useQuery(undefined, {
    enabled: Boolean(orgId),
    retry: false,
  });

  const initMutation = trpc.onboarding.initialize.useMutation({
    onSuccess: () => void utils.onboarding.getState.invalidate(),
  });

  const skipMutation = trpc.onboarding.skip.useMutation({
    onSuccess: () => router.push('/dashboard'),
  });

  const sampleDataMutation = trpc.onboarding.loadSampleData.useMutation({
    onSuccess: async () => {
      await utils.onboarding.getState.invalidate();
    },
  });

  const [sampleLoaded, setSampleLoaded] = useState(false);

  const state = stateQuery.data;
  const completedSteps: string[] = Array.isArray(state?.completedSteps) ? state.completedSteps : [];
  const isSkipped = state?.isSkipped ?? false;
  const isCompleted = state?.isCompleted ?? false;

  const completedCount = STEPS.filter((s) => completedSteps.includes(s.key)).length;
  const progressPct = Math.round((completedCount / STEPS.length) * 100);

  function handleLoadSampleData(): void {
    if (!orgId) return;
    sampleDataMutation.mutate(
      { organizationId: orgId },
      {
        onSuccess: () => {
          setSampleLoaded(true);
        },
      },
    );
  }

  if (orgsQuery.isLoading || stateQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Welcome to EstimatePro</h1>
        <p className="mt-2 text-muted-foreground">
          Let&apos;s get you set up. We&apos;ll walk you through the key steps to start estimating projects with your team.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => initMutation.mutate()}
            disabled={initMutation.isPending || !orgId}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {initMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Start Setup
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  if (isSkipped || isCompleted) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <h2 className="mt-4 text-xl font-semibold">
            {isCompleted ? 'Setup complete!' : 'Onboarding skipped'}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isCompleted
              ? 'You\'ve completed all setup steps. Enjoy EstimatePro!'
              : 'You can return here anytime to complete setup.'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Getting Started</h1>
        <p className="mt-1 text-muted-foreground">
          Complete these steps to get the most out of EstimatePro.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{completedCount} of {STEPS.length} steps completed</span>
          <span className="text-muted-foreground">{progressPct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="mt-6 space-y-3">
        {STEPS.map((step, index) => {
          const done = completedSteps.includes(step.key);
          return (
            <button
              key={step.key}
              onClick={() => router.push(step.href)}
              className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/30"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
                    {done && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Done
                      </span>
                    )}
                  </div>
                  <h3 className={`mt-0.5 font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>
                    {step.title}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Load sample data */}
      <div className="mt-6 rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">Try it with sample data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Load a demo project with realistic tasks to explore the platform before adding your own data.
        </p>
        <button
          onClick={handleLoadSampleData}
          disabled={sampleDataMutation.isPending || sampleLoaded || !orgId}
          className="mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {sampleDataMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {sampleLoaded ? 'Sample data loaded!' : 'Load sample data'}
        </button>
      </div>

      {/* Skip */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => skipMutation.mutate()}
          disabled={skipMutation.isPending}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <SkipForward className="h-3.5 w-3.5" />
          Skip setup
        </button>
      </div>
    </div>
  );
}
