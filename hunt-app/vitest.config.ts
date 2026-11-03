import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/db/seed.ts',
        'src/db/migrate.ts',
        'src/index.ts',
      ],
    },
  },
});