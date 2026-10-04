/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // sin la burbuja de Next.js abajo a la izquierda en desarrollo
  devIndicators: false,
  outputFileTracingRoot: process.cwd() + "/../..",
  async headers() {
    const seguridad = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      // Solo aporta sobre HTTPS (Render); en local no hace nada.
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ];
    return [{ source: "/:path*", headers: seguridad }];
  },
};

export default nextConfig;
