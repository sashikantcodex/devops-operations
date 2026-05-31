#!/usr/bin/env bash
# Blue-Green traffic switch script
set -euo pipefail

NAMESPACE="mern-app"
SERVICE="backend"

current_slot=$(kubectl get service "$SERVICE" -n "$NAMESPACE" -o jsonpath='{.spec.selector.slot}')
echo "Current active slot: $current_slot"

if [[ "$current_slot" == "blue" ]]; then
  new_slot="green"
else
  new_slot="blue"
fi

echo "Switching traffic to: $new_slot"

# Verify target deployment is healthy before switching
READY=$(kubectl get deployment "backend-${new_slot}" -n "$NAMESPACE" \
  -o jsonpath='{.status.readyReplicas}')

if [[ -z "$READY" || "$READY" -lt 1 ]]; then
  echo "ERROR: $new_slot deployment is not ready. Aborting switch."
  exit 1
fi

kubectl patch service "$SERVICE" -n "$NAMESPACE" \
  -p "{\"spec\":{\"selector\":{\"app\":\"backend\",\"slot\":\"${new_slot}\"}}}"

echo "Traffic switched to $new_slot. Verify with:"
echo "  kubectl get pods -n $NAMESPACE -l slot=$new_slot"
echo ""
echo "To rollback, run: SLOT=$current_slot ./switch-traffic.sh"
