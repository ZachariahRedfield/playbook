#!/usr/bin/env bash
set -e

echo "Building Playbook..."
pnpm build

echo "Recording CLI demo..."
asciinema rec -q -c "node packages/cli/dist/main.js demo" playbook-demo.cast

echo "Converting recording to GIF..."
mkdir -p docs/assets
agg playbook-demo.cast docs/assets/playbook-demo.gif

echo "Cleaning temporary files..."
rm playbook-demo.cast

echo "Demo GIF updated."
