#!/usr/bin/env bash
# Rollback script — reverts to the previous Helm release revision
set -euo pipefail

NAMESPACE="${NAMESPACE:-mern-app}"
RELEASE="${RELEASE:-mern-app}"
REVISIONS_TO_SHOW=5

echo "Recent Helm history for release '$RELEASE':"
helm history "$RELEASE" -n "$NAMESPACE" --max "$REVISIONS_TO_SHOW"

echo ""
read -rp "Enter revision to roll back to (leave empty for previous): " TARGET_REVISION

if [[ -z "$TARGET_REVISION" ]]; then
  echo "Rolling back to previous revision..."
  helm rollback "$RELEASE" -n "$NAMESPACE" --wait --timeout 3m
else
  echo "Rolling back to revision $TARGET_REVISION..."
  helm rollback "$RELEASE" "$TARGET_REVISION" -n "$NAMESPACE" --wait --timeout 3m
fi

echo ""
echo "Rollback complete. Current status:"
kubectl get pods -n "$NAMESPACE"
helm status "$RELEASE" -n "$NAMESPACE"
