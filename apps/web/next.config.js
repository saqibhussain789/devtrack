import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/shared"],
  // Bundles only the files a running Next.js server actually needs into
  // .next/standalone, so the production Docker image doesn't have to ship
  // the full node_modules tree (which includes turbo, eslint, etc.).
  output: "standalone",
  // In a monorepo, file tracing needs to look above apps/web to see
  // node_modules hoisted to the workspace root and packages/shared — without
  // this it only traces within apps/web and standalone output misses files.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
