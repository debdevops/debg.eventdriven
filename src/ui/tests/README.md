# E2E Tests

Run Playwright tests locally:

1. `cd src/ui`
2. `npm install`
3. `npm run playwright:install`
4. Start the UI with test mode enabled (short idle timers optional):
   - `VITE_TEST_MODE=true npm run dev`
   - Optional: `IDLE_TOAST_MS=2000 IDLE_BANNER_MS=3000 IDLE_MODAL_MS=4000 VITE_TEST_MODE=true npm run dev`
5. In another terminal: `npm run test:e2e`

Set `UI_BASE_URL` env to override base URL if needed.
