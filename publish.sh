#!/bin/sh
# Copies the two sites from their own repos into this one and pushes. GitHub Pages serves the main branch.
set -e
cd "$(dirname "$0")"
mkdir -p padel-101 shot-breaks
cp ../padel-101/index.html padel-101/index.html
cp ../padel-shot-breaks/index.html shot-breaks/index.html
git add -A
git diff --cached --quiet && { echo "Nothing changed."; exit 0; }
git commit -q -m "${1:-Update sites}"
git push -q origin main
echo "Pushed. Live in about a minute at https://vittoalexander.github.io/padelwithvitto/"
