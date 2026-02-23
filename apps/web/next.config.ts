import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  transpilePackages: ['@estimate-pro/ui', '@estimate-pro/types'],
  outputFileTracingRoot: path.join(process.cwd(), '../../'),
};

export default withNextIntl(nextConfig);
