import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // The presentation walkthrough is a self-contained page in public/, so it
      // renders without a database — useful while the deployment is still being
      // wired up. The rewrite is only here to drop the .html from the URL.
      { source: '/presentation', destination: '/presentation.html' },
    ];
  },
};

export default nextConfig;
