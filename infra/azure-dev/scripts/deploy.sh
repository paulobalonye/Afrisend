#!/usr/bin/env bash
# deploy.sh — Deploy AfriSend dev stack to the Azure B2s VM via SSH
#
# Required environment variables:
#   VM_IP         — Public IP of the Azure dev VM (from Terraform output vm_public_ip)
#   SSH_KEY_PATH  — Path to the SSH private key (default: ~/.ssh/id_rsa)
#   ENV_FILE      — Path to .env file for the backend (default: .env)
#
# Usage:
#   VM_IP=<IP> ./infra/azure-dev/scripts/deploy.sh
#   VM_IP=<IP> SSH_KEY_PATH=~/.ssh/azure_dev ENV_FILE=.env.azure-dev ./infra/azure-dev/scripts/deploy.sh

set -euo pipefail

# ─── Validate required env vars ──────────────────────────────────────────────

if [ -z "${VM_IP:-}" ]; then
  echo "ERROR: VM_IP is required. Export it or get it from: terraform -chdir=infra/azure-dev output vm_public_ip"
  exit 1
fi

SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/id_rsa}"
VM_USER="${VM_USER:-azureuser}"
ENV_FILE="${ENV_FILE:-.env}"
APP_DIR="/opt/afrisend"
COMPOSE_FILE="docker-compose.yml"
COMPOSE_OVERRIDE="docker-compose.azure-dev.yml"

SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=15 -i $SSH_KEY_PATH"

echo "==> Deploying AfriSend dev stack to VM $VM_IP..."

# ─── Wait for VM to be reachable ─────────────────────────────────────────────

echo "==> Checking SSH connectivity..."
for i in {1..10}; do
  if ssh $SSH_OPTS "$VM_USER@$VM_IP" "echo 'SSH OK'" 2>/dev/null; then
    break
  fi
  echo "    Attempt $i/10 — retrying in 5s..."
  sleep 5
done

# ─── Copy application files to VM ────────────────────────────────────────────

echo "==> Copying docker-compose files to $VM_IP:$APP_DIR..."
rsync -avz --delete \
  -e "ssh $SSH_OPTS" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='apps/web/.next' \
  --exclude='apps/mobile/.expo' \
  --exclude='coverage' \
  --include="$COMPOSE_FILE" \
  --include="$COMPOSE_OVERRIDE" \
  --include='Dockerfile.backend' \
  --include='src/***' \
  --include='tsconfig.json' \
  --include='tsconfig.base.json' \
  --include='package.json' \
  --include='package-lock.json' \
  --include='kong/***' \
  --include='monitoring/***' \
  --include='apps/api/***' \
  --include='packages/***' \
  --exclude='*' \
  ./ "$VM_USER@$VM_IP:$APP_DIR/"

# ─── Copy environment file ────────────────────────────────────────────────────

if [ -f "$ENV_FILE" ]; then
  echo "==> Copying environment file..."
  scp $SSH_OPTS "$ENV_FILE" "$VM_USER@$VM_IP:$APP_DIR/.env"
else
  echo "WARNING: $ENV_FILE not found — skipping. Make sure .env exists on the VM."
fi

# ─── Run docker compose on VM ─────────────────────────────────────────────────

echo "==> Starting services with docker compose..."
ssh $SSH_OPTS "$VM_USER@$VM_IP" "cd $APP_DIR && \
  docker compose -f $COMPOSE_FILE -f $COMPOSE_OVERRIDE pull --quiet && \
  docker compose -f $COMPOSE_FILE -f $COMPOSE_OVERRIDE up -d --remove-orphans && \
  docker compose -f $COMPOSE_FILE -f $COMPOSE_OVERRIDE ps"

# ─── Health check ─────────────────────────────────────────────────────────────

echo "==> Waiting 30s for services to be healthy..."
sleep 30

echo "==> Running health check..."
HEALTH_URL="http://$VM_IP:8000/health"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
  echo ""
  echo "Deployment successful!"
  echo "  API (Kong proxy): http://$VM_IP:8000"
  echo "  Grafana:          http://$VM_IP:3001"
  echo "  Prometheus:       http://$VM_IP:9090"
else
  echo "WARNING: Health check returned HTTP $HTTP_STATUS (expected 200)."
  echo "Check logs with: ssh $SSH_KEY_PATH $VM_USER@$VM_IP 'cd $APP_DIR && docker compose logs --tail=50'"
  exit 1
fi
