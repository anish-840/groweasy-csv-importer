import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the workspace `shared` package (TypeScript source) as part of the app.
  transpilePackages: ['@groweasy/shared'],
  // Produce a self-contained server bundle for a small Docker image.
  output: 'standalone',
  // In a monorepo, trace files from the repo root so workspace deps are included.
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
