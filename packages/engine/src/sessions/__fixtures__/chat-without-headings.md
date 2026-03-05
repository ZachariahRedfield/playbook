We discussed the migration.
Decision: Use npm scripts only for smoke tests.
$ pnpm -r test
npm run build
This touched docs/CHANGELOG.md and packages/cli/src/main.ts
Chosen: Keep cleanup defaults at 30 days and 50 files.
See https://example.com/runbook for rollout.
