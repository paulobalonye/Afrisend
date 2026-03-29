#!/usr/bin/env bash
# bootstrap-vm.sh — Install Docker and Docker Compose on the Azure dev VM
# Run this manually if cloud-init did not complete, or to re-bootstrap.
#
# Usage: ssh azureuser@<VM_IP> 'bash -s' < infra/azure-dev/scripts/bootstrap-vm.sh

set -euo pipefail

echo "==> Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

echo "==> Installing prerequisites..."
sudo apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git

echo "==> Adding Docker GPG key and repository..."
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc > /dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

echo "==> Installing docker-ce, containerd, and docker-compose-plugin..."
sudo apt-get update -y
sudo apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

echo "==> Adding current user to docker group..."
sudo usermod -aG docker "$USER"

echo "==> Enabling and starting Docker service..."
sudo systemctl enable docker
sudo systemctl start docker

echo "==> Creating /opt/afrisend application directory..."
sudo mkdir -p /opt/afrisend
sudo chown "$USER":"$USER" /opt/afrisend

echo ""
echo "Bootstrap complete."
echo "NOTE: Log out and back in (or run 'newgrp docker') for docker group membership to take effect."
echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker compose version)"
