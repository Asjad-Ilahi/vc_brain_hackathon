import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf ships a PDF.js build; keep it external to the server bundle for reliability.
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
