'use client';

import { Check, ExternalLink, Link2, Link2Off } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type SupportedIntegrationType = 'jira' | 'github';

const supportedIntegrations: Array<{
  id: SupportedIntegrationType;
  name: string;
  description: string;
  icon: string;
  color: string;
}> = [
  {
    id: 'jira',
    name: 'Jira',
    description: 'Import and sync issues from Atlassian Jira',
    icon: '🔵',
    color: 'border-blue-500',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Import issues from GitHub repositories',
    icon: '⚫',
    color: 'border-gray-500',
  },
];

const plannedIntegrations = [
  { id: 'azure_devops', name: 'Azure DevOps', description: 'Planned - work item sync' },
  { id: 'gitlab', name: 'GitLab', description: 'Planned - issue sync' },
];

function parseCallbackType(rawState: string | null): SupportedIntegrationType | null {
  if (!rawState) {
    return null;
  }

  try {
    const decoded = JSON.parse(atob(rawState)) as { type?: string };
    if (decoded.type === 'jira' || decoded.type === 'github') {
      return decoded.type;
    }
  } catch {
    return null;
  }

  return null;
}

export default function IntegrationsPage(): React.ReactElement {
  const utils = trpc.useUtils();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [notice, setNotice] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [callbackHandled, setCallbackHandled] = useState(false);

  const orgsQuery = trpc.organization.list.useQuery(undefined, { retry: false });
  const orgId = orgsQuery.data?.[0]?.id ?? '';

  const integrationsQuery = trpc.integration.list.useQuery(
    { organizationId: orgId },
    { enabled: Boolean(orgId), retry: false },
  );

  const callbackMutation = trpc.integration.callback.useMutation({
    onSuccess: async () => {
      setNotice('Integration connected successfully.');
      setError('');
      await integrationsQuery.refetch();
    },
    onError: (mutationError) => {
      setError(mutationError.message);
      setNotice('');
    },
  });

  const disconnectMutation = trpc.integration.disconnect.useMutation({
    onSuccess: async () => {
      setNotice('Integration disconnected.');
      setError('');
      await integrationsQuery.refetch();
    },
    onError: (mutationError) => {
      setError(mutationError.message);
      setNotice('');
    },
  });

  useEffect(() => {
    if (!orgId || callbackHandled) {
      return;
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return;
    }

    const integrationType = parseCallbackType(state);
    if (!integrationType) {
      setError('OAuth callback state is invalid.');
      setCallbackHandled(true);
      return;
    }

    const redirectUri = `${window.location.origin}/dashboard/integrations`;

    callbackMutation.mutate({
      organizationId: orgId,
      type: integrationType,
      code,
      redirectUri,
    });

    setCallbackHandled(true);
    router.replace('/dashboard/integrations');
  }, [callbackHandled, callbackMutation, orgId, router, searchParams]);

  const integrationsByType = useMemo(() => {
    const map = new Map<string, NonNullable<typeof integrationsQuery.data>[number]>();
    for (const integration of integrationsQuery.data ?? []) {
      if (integration.isActive) {
        map.set(integration.type, integration);
      }
    }
    return map;
  }, [integrationsQuery.data]);

  async function handleConnect(type: SupportedIntegrationType): Promise<void> {
    if (!orgId) {
      return;
    }

    try {
      const redirectUri = `${window.location.origin}/dashboard/integrations`;
      const response = await utils.integration.getAuthUrl.fetch({
        organizationId: orgId,
        type,
        redirectUri,
      });

      window.location.href = response.url;
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Failed to start OAuth flow');
      setNotice('');
    }
  }

  function handleDisconnect(integrationId: string): void {
    disconnectMutation.mutate({ integrationId });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Integrations</h1>
      <p className="mt-1 text-muted-foreground">Connect external tools to import and sync project data.</p>

      {notice && (
        <div className="mt-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          {notice}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {supportedIntegrations.map((integration) => {
          const activeIntegration = integrationsByType.get(integration.id);
          const isConnected = Boolean(activeIntegration);

          return (
            <div
              key={integration.id}
              className={cn(
                'rounded-lg border-l-4 border bg-card p-6 transition-colors',
                integration.color,
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{integration.icon}</span>
                  <div>
                    <h3 className="font-semibold">{integration.name}</h3>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </div>
                </div>
                {isConnected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                    <Check className="h-3 w-3" />
                    Connected
                  </span>
                )}
              </div>

              {isConnected && activeIntegration && (
                <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <p>Last sync: {activeIntegration.lastSyncAt ? new Date(activeIntegration.lastSyncAt).toLocaleString() : 'Never'}</p>
                  <p>Token encrypted: {activeIntegration.accessTokenEncrypted ? 'Yes' : 'No'}</p>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                {isConnected && activeIntegration ? (
                  <>
                    <button className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                      <ExternalLink className="h-3 w-3" />
                      Active
                    </button>
                    <button
                      onClick={() => handleDisconnect(activeIntegration.id)}
                      disabled={disconnectMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
                    >
                      <Link2Off className="h-3 w-3" />
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { void handleConnect(integration.id); }}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Link2 className="h-3 w-3" />
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Planned Integrations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These providers are intentionally disabled from OAuth flow until backend support is completed.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {plannedIntegrations.map((integration) => (
            <div key={integration.id} className="rounded-md border border-dashed p-4">
              <p className="text-sm font-medium">{integration.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{integration.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
