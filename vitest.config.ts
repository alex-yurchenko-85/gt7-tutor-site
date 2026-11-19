import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tools/site/**/*.spec.ts']
  }
});
