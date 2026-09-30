/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // sin la burbuja de Next.js abajo a la izquierda en desarrollo
  devIndicators: false,
  outputFileTracingRoot: process.cwd() + "/../..",
};

export default nextConfig;
