'use client';

import { useState } from 'react';
import { ExternalLink, Webhook } from 'lucide-react';
import Link from 'next/link';

import { WebhookForm } from '@/components/webhooks/webhook-form';
import { WebhookList } from '@/components/webhooks/webhook-list';

export default function WebhooksPage(): React.ReactElement {
  const [notice, setNotice] = useState<string>('');
  const [error, setError] = useState<string>('');

  function handleSuccess(message?: string): void {
    if (message) {
      setNotice(message);
    }
    setError('');
    setTimeout(() => setNotice(''), 5000);
  }

  function handleError(errorMessage: string): void {
    setError(errorMessage);
    setNotice('');
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="mt-1 text-muted-foreground">
            Configure webhooks to receive real-time event notifications from EstimatePro.
          </p>
        </div>
        <Link
          href="/api/docs#webhooks"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <Webhook className="h-4 w-4" />
          Webhook Documentation
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {notice && (
        <div className="mt-4 rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
          {notice}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-6">
        <WebhookForm onSuccess={() => handleSuccess('Webhook created successfully')} onError={handleError} />

        <div>
          <h2 className="text-lg font-semibold">Your Webhooks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your webhook endpoints and view delivery logs below.
          </p>
          <div className="mt-4">
            <WebhookList onSuccess={handleSuccess} onError={handleError} />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Getting Started</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <h3 className="font-medium">1. Create a Webhook Endpoint</h3>
              <p className="mt-1 text-muted-foreground">
                Set up an HTTPS endpoint on your server to receive webhook POST requests.
              </p>
            </div>
            <div>
              <h3 className="font-medium">2. Configure Your Webhook</h3>
              <p className="mt-1 text-muted-foreground">
                Enter your endpoint URL, select the events you want to receive, and generate a secret for signature verification.
              </p>
            </div>
            <div>
              <h3 className="font-medium">3. Verify Signatures</h3>
              <p className="mt-1 text-muted-foreground">
                Use the webhook secret to verify the HMAC-SHA256 signature in the X-Webhook-Signature header:
              </p>
              <pre className="mt-2 rounded-md bg-muted p-3 font-mono text-xs">
{`const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}`}
              </pre>
            </div>
            <div>
              <h3 className="font-medium">4. Available Events</h3>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• <code className="rounded bg-muted px-1.5 py-0.5">estimation.completed</code> - Estimation session finalized</li>
                <li>• <code className="rounded bg-muted px-1.5 py-0.5">task.created</code> - New task created</li>
                <li>• <code className="rounded bg-muted px-1.5 py-0.5">task.updated</code> - Task modified</li>
                <li>• <code className="rounded bg-muted px-1.5 py-0.5">analysis.exported</code> - Cost analysis exported</li>
                <li>• <code className="rounded bg-muted px-1.5 py-0.5">sync.completed</code> - Integration sync finished</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium">5. Respond with 2xx Status</h3>
              <p className="mt-1 text-muted-foreground">
                Your endpoint must respond with a 2xx status code within 10 seconds. Failures trigger automatic retries with exponential backoff.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-500/50 bg-blue-50 p-4 dark:bg-blue-950/20">
          <h3 className="font-medium text-blue-900 dark:text-blue-100">
            🔔 Retry Policy
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>• Failed deliveries are automatically retried 3 times</li>
            <li>• Retry delays use exponential backoff: 1s, 4s, 16s</li>
            <li>• You can manually retry failed deliveries from the delivery log</li>
            <li>• Webhooks timing out after 10 seconds are considered failed</li>
            <li>• Only 2xx status codes are considered successful</li>
          </ul>
        </div>

        <div className="rounded-lg border border-yellow-500/50 bg-yellow-50 p-4 dark:bg-yellow-950/20">
          <h3 className="font-medium text-yellow-900 dark:text-yellow-100">
            🔒 Security Best Practices
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
            <li>• Always use HTTPS endpoints (HTTP is not supported)</li>
            <li>• Verify the webhook signature on every request</li>
            <li>• Store webhook secrets securely (environment variables)</li>
            <li>• Implement idempotency to handle duplicate deliveries</li>
            <li>• Return 2xx status quickly and process events asynchronously</li>
            <li>• Monitor delivery logs for suspicious activity</li>
            <li>• Rotate webhook secrets periodically</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
