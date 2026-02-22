'use client';

import { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/api-url';

/**
 * API Documentation Viewer Page
 *
 * Embeds the Swagger UI served by the API server at /api/docs
 * The Swagger UI provides interactive documentation for the EstimatePro Public REST API
 * including authentication, endpoints, schemas, and the ability to test API calls
 */
export default function ApiDocsPage(): React.ReactElement {
  const [swaggerUrl, setSwaggerUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get the API server's Swagger UI URL
    // The API server serves Swagger UI at /api/docs
    const url = getApiUrl('/api/docs');
    setSwaggerUrl(url);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-sm text-muted-foreground">Loading API documentation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">API Documentation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Interactive API documentation powered by Swagger UI
          </p>
        </div>
      </div>

      {/* Swagger UI iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={swaggerUrl}
          title="API Documentation - Swagger UI"
          className="h-full w-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
