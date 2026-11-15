#!/bin/sh
# Copies the sites from their own folders into this one and pushes. GitHub Pages serves the main branch.
set -e
cd "$(dirname "$0")"
mkdir -p padel-101 shot-breaks
cp ../padel-101/index.html padel-101/index.html
cp ../padel-shot-breaks/index.html shot-breaks/index.html
rsync -a --delete --exclude PLAN.md --exclude .DS_Store --exclude .claude ../padel-athlete-site/ road-to-pro/
git add -A
git diff --cached --quiet && { echo "Nothing changed."; exit 0; }
git commit -q -m "${1:-Update sites}"
git push -q origin main
echo "Pushed. Live in about a minute at https://vittoalexander.github.io/padelwithvitto/"
