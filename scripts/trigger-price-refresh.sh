#!/usr/bin/env bash
# Manually trigger the price watch refresh workflow on GitHub Actions.
# Requires the GitHub CLI (gh) to be installed and authenticated.
#
# Usage:
#   ./scripts/trigger-price-refresh.sh
#
# The workflow runs on a GitHub Actions runner that has Playwright + Chromium
# available. Check progress at the URL printed below.

set -euo pipefail

REPO="chris-catignani/hotel-tracker"
WORKFLOW="refresh-price-watches.yml"

echo "Triggering price watch refresh on GitHub Actions..."
gh workflow run "$WORKFLOW" --repo "$REPO"

echo ""
echo "Workflow queued. Monitor progress at:"
echo "  https://github.com/$REPO/actions/workflows/$WORKFLOW"
echo ""
echo "Or run: gh run list --repo $REPO --workflow $WORKFLOW --limit 1"
