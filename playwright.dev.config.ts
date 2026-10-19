import { defineConfig } from '@playwright/test'
import config from './playwright.config'

export default defineConfig({
  ...config,
  testMatch: /(lifecycle|export)\.spec\.ts/,
  grep: /seleção por ponteiro|PNG e JPEG reais|fotografias pessoais/,
  outputDir: 'test-results-dev',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-dev' }]],
  use: { ...config.use, baseURL: 'http://127.0.0.1:5173' },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
})
