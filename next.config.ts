import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The dev-only route badge sits on top of the mobile bottom tab bar. Errors are still shown.
  devIndicators: false,
};

export default nextConfig;
