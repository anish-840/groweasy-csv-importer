import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // Bundle the workspace `shared` package (its "main" points at TS source) so the
  // compiled server is fully self-contained; keep node_modules external.
  noExternal: ['@groweasy/shared'],
});
