Output docs/demo.gif
Set Theme "Tokyo Night"
Set Width 1200
Set Height 800
Set FontSize 18
Set TypingSpeed 80

Type "mkdir -p /tmp/playbook-demo && cd /tmp/playbook-demo"
Enter
Type "git init -b main"
Enter
Type "git config user.email demo@example.com && git config user.name demo"
Enter

Type "node /workspace/playbook/packages/cli/dist/main.js init"
Enter
Type "git add . && git commit -m 'init playbook'"
Enter

Type "mkdir -p src && echo 'export const x = 1;' > src/foo.ts"
Enter
Type "git add src/foo.ts && git commit -m 'feat: add source change'"
Enter

Type "node /workspace/playbook/packages/cli/dist/main.js verify"
Enter

Type "printf '\n- WHAT changed: Added src/foo.ts\n- WHY it changed: Demo notes update\n' >> docs/PLAYBOOK_NOTES.md"
Enter
Type "git add docs/PLAYBOOK_NOTES.md && git commit -m 'docs: update pnpm playbook notes'"
Enter

Type "node /workspace/playbook/packages/cli/dist/main.js verify"
Enter
