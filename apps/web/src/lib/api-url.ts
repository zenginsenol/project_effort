'use client';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return trimTrailingSlash(envUrl);
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin } = window.location;
    if (LOCAL_HOSTS.has(hostname)) {
      return `${protocol}//${hostname}:4000`;
    }
    return trimTrailingSlash(origin);
  }

  return 'http://localhost:4000';
}

export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
