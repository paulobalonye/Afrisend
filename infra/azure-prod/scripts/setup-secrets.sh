#!/usr/bin/env bash
# ─── AfriSend Azure Secrets Setup ────────────────────────────────────────────
# Run this AFTER terraform apply to set real secret values on the Container App.
#
# Usage:
#   export AFRISEND_ENV_FILE=path/to/.env.production
#   ./setup-secrets.sh
#
# Or pass values directly:
#   YC_PUBKEY=xxx YC_SECRET=yyy ./setup-secrets.sh
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-afrisend-prod}"
CONTAINER_APP="${CONTAINER_APP:-ca-afrisend-prod-api}"

# Load from env file if provided
if [[ -n "${AFRISEND_ENV_FILE:-}" ]] && [[ -f "$AFRISEND_ENV_FILE" ]]; then
  echo "Loading secrets from $AFRISEND_ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$AFRISEND_ENV_FILE"
  set +a
fi

# Map of secret-name -> env-var-name
declare -A SECRETS=(
  ["yc-pubkey"]="YC_PUBKEY"
  ["yc-secret"]="YC_SECRET"
  ["yc-merchantid"]="YC_MERCHANTID"
  ["veriff-pkey"]="VERIFF_PKEY"
  ["veriff-skey"]="VERIFF_SKEY"
  ["resend-api-key"]="RESEND_API_KEY"
  ["flw-public-key"]="FLW_PUBLIC_KEY"
  ["flw-secret-key"]="FLW_SECRET_KEY"
  ["flw-encryption-key"]="FLW_ENCRYPTION_KEY"
  ["stripe-secret-key"]="STRIPE_SECRET_KEY"
  ["stripe-publishable-key"]="STRIPE_PUBLISHABLE_KEY"
  ["stripe-webhook-secret"]="STRIPE_WEBHOOK_SECRET"
)

echo "Updating secrets on $CONTAINER_APP in $RESOURCE_GROUP..."

UPDATES=""
SKIPPED=0

for secret_name in "${!SECRETS[@]}"; do
  env_var="${SECRETS[$secret_name]}"
  value="${!env_var:-}"

  if [[ -z "$value" ]] || [[ "$value" == "CHANGE_ME" ]]; then
    echo "  SKIP: $secret_name (env var $env_var not set)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  UPDATES="${UPDATES} ${secret_name}=${value}"
done

if [[ -n "$UPDATES" ]]; then
  # shellcheck disable=SC2086
  az containerapp secret set \
    --name "$CONTAINER_APP" \
    --resource-group "$RESOURCE_GROUP" \
    $UPDATES

  echo ""
  echo "Secrets updated. Restarting container app..."
  az containerapp revision restart \
    --name "$CONTAINER_APP" \
    --resource-group "$RESOURCE_GROUP"
else
  echo "No secrets to update."
fi

if [[ $SKIPPED -gt 0 ]]; then
  echo ""
  echo "WARNING: $SKIPPED secrets were skipped (not set in environment)."
  echo "Set them and re-run this script before going live."
fi
