import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@estimate-pro/ui', '@estimate-pro/types'],
  outputFileTracingRoot: path.join(process.cwd(), '../../'),
};

export default nextConfig;
