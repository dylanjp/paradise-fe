/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true, // Required for static export
  },
  trailingSlash: true, // Ensures paths work correctly on GitHub Pages
  assetPrefix: process.env.NODE_ENV === "production" ? "https://dylanjohnpratt.com/" : "", // Use full URL in production, nothing locally
};

export default nextConfig;