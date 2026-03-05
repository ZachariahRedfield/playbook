@"
# Decisions
- CLI should build with tsc

# Constraints
- CLI must run offline
- CLI must run in CI

# Open Questions
- Should Playbook publish a GitHub Action?

# Artifacts
docs/PLAYBOOK_PRODUCT_ROADMAP.md
packages/cli/src/main.ts

# Next Steps
- Build demo repo
"@ | Out-File -Encoding utf8 test-chat.md