'use client';

import { useState } from 'react';
import { ExternalLink, Key } from 'lucide-react';
import Link from 'next/link';

import { ApiKeyForm } from '@/components/api-keys/api-key-form';
import { ApiKeyList } from '@/components/api-keys/api-key-list';

export default function ApiKeysPage(): React.ReactElement {
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
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="mt-1 text-muted-foreground">
            Manage public API keys for programmatic access to EstimatePro.
          </p>
        </div>
        <Link
          href="/api/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <Key className="h-4 w-4" />
          API Documentation
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
        <ApiKeyForm onSuccess={() => handleSuccess('API key created successfully')} onError={handleError} />

        <div>
          <h2 className="text-lg font-semibold">Your API Keys</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and rotate your existing API keys below.
          </p>
          <div className="mt-4">
            <ApiKeyList onSuccess={handleSuccess} onError={handleError} />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Getting Started</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <h3 className="font-medium">1. Create an API Key</h3>
              <p className="mt-1 text-muted-foreground">
                Click "Create API Key" above and give it a descriptive name.
              </p>
            </div>
            <div>
              <h3 className="font-medium">2. Copy Your Key</h3>
              <p className="mt-1 text-muted-foreground">
                You'll only see the full API key once. Store it securely in your application's environment variables.
              </p>
            </div>
            <div>
              <h3 className="font-medium">3. Make API Requests</h3>
              <p className="mt-1 text-muted-foreground">
                Include your API key in the Authorization header:
              </p>
              <pre className="mt-2 rounded-md bg-muted p-3 font-mono text-xs">
                {`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  ${typeof window !== 'undefined' ? window.location.origin : 'https://app.estimatepro.com'}/api/v1/projects`}
              </pre>
            </div>
            <div>
              <h3 className="font-medium">4. Explore the API</h3>
              <p className="mt-1 text-muted-foreground">
                Visit our interactive API documentation to explore available endpoints and try them out.
              </p>
              <Link
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
              >
                Open API Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-yellow-500/50 bg-yellow-50 p-4 dark:bg-yellow-950/20">
          <h3 className="font-medium text-yellow-900 dark:text-yellow-100">
            🔒 Security Best Practices
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
            <li>• Never commit API keys to version control</li>
            <li>• Use environment variables to store keys</li>
            <li>• Rotate keys regularly using the "Rotate" action</li>
            <li>• Disable or delete keys that are no longer in use</li>
            <li>• Monitor the "Last used" timestamp for suspicious activity</li>
            <li>• Use different keys for different environments (dev, staging, production)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
