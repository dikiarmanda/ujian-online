import type { NextConfig } from "next";

const scriptSrc = process.env.NODE_ENV === "production" ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: ["default-src 'self'", "img-src 'self' data: blob:", "style-src 'self' 'unsafe-inline'", scriptSrc, "connect-src 'self'", "font-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1", "localhost", "ujian.dikdasmen.id"],
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-mariadb", "mariadb", "bullmq", "ioredis", "pdfkit", "bcrypt"],
  async headers() {
    const headers = [...securityHeaders];
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
