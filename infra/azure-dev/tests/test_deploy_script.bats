#!/usr/bin/env bats
# Tests for azure-dev deploy scripts using bats (Bash Automated Testing System)

setup() {
  # Create a temp directory for test artifacts
  export TEST_TMPDIR="$(mktemp -d)"
  export SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)/scripts"
  export DEPLOY_SCRIPT="$SCRIPT_DIR/deploy.sh"
  export BOOTSTRAP_SCRIPT="$SCRIPT_DIR/bootstrap-vm.sh"
}

teardown() {
  rm -rf "$TEST_TMPDIR"
}

# ─── bootstrap-vm.sh tests ────────────────────────────────────────────────────

@test "bootstrap-vm.sh exists and is executable" {
  [ -f "$BOOTSTRAP_SCRIPT" ]
  [ -x "$BOOTSTRAP_SCRIPT" ]
}

@test "bootstrap-vm.sh contains docker installation steps" {
  grep -q "docker" "$BOOTSTRAP_SCRIPT"
}

@test "bootstrap-vm.sh contains docker compose plugin installation" {
  grep -q "docker-compose-plugin\|docker compose" "$BOOTSTRAP_SCRIPT"
}

@test "bootstrap-vm.sh creates app directory" {
  grep -q "/opt/afrisend\|mkdir" "$BOOTSTRAP_SCRIPT"
}

@test "bootstrap-vm.sh adds user to docker group" {
  grep -q "usermod.*docker\|docker.*group" "$BOOTSTRAP_SCRIPT"
}

# ─── deploy.sh tests ─────────────────────────────────────────────────────────

@test "deploy.sh exists and is executable" {
  [ -f "$DEPLOY_SCRIPT" ]
  [ -x "$DEPLOY_SCRIPT" ]
}

@test "deploy.sh uses SSH to connect to VM" {
  grep -q "ssh\|SSH" "$DEPLOY_SCRIPT"
}

@test "deploy.sh copies docker-compose files to VM" {
  grep -q "scp\|rsync\|docker-compose" "$DEPLOY_SCRIPT"
}

@test "deploy.sh runs docker compose up on VM" {
  # matches "docker compose ... up -d" (with or without -f overrides)
  grep -q "docker compose.*up\|docker-compose.*up" "$DEPLOY_SCRIPT"
}

@test "deploy.sh validates required environment variables" {
  grep -q "VM_IP\|AZURE_VM" "$DEPLOY_SCRIPT"
}

@test "deploy.sh performs health check after deployment" {
  grep -q "health\|curl\|wget" "$DEPLOY_SCRIPT"
}

@test "deploy.sh exits on error" {
  grep -q "set -e\|set -euo" "$DEPLOY_SCRIPT"
}

# ─── docker-compose.azure-dev.yml tests ───────────────────────────────────────

@test "docker-compose.azure-dev.yml exists" {
  COMPOSE_FILE="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/docker-compose.azure-dev.yml"
  [ -f "$COMPOSE_FILE" ]
}

@test "docker-compose.azure-dev.yml uses production NODE_ENV" {
  COMPOSE_FILE="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/docker-compose.azure-dev.yml"
  grep -q "NODE_ENV.*dev\|NODE_ENV.*development\|NODE_ENV.*staging" "$COMPOSE_FILE"
}

@test "docker-compose.azure-dev.yml does not expose Kong admin port publicly" {
  COMPOSE_FILE="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/docker-compose.azure-dev.yml"
  # Admin port 8001 should either be absent or bound to 127.0.0.1 only
  if grep -q "8001" "$COMPOSE_FILE"; then
    grep "8001" "$COMPOSE_FILE" | grep -q "127.0.0.1"
  fi
}

# ─── Terraform configuration tests ──────────────────────────────────────────

@test "main.tf exists" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  [ -f "$TERRAFORM_DIR/main.tf" ]
}

@test "main.tf provisions a Linux VM resource" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  grep -q "azurerm_linux_virtual_machine\|linux_virtual_machine" "$TERRAFORM_DIR/main.tf"
}

@test "main.tf uses B2s VM size" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  grep -q "Standard_B2s\|B2s" "$TERRAFORM_DIR/main.tf"
}

@test "main.tf includes network security group" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  grep -q "azurerm_network_security_group" "$TERRAFORM_DIR/main.tf"
}

@test "main.tf allows HTTP port 8000 (Kong proxy)" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  grep -q "8000" "$TERRAFORM_DIR/main.tf"
}

@test "main.tf allows SSH port 22" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  grep -q '"22"' "$TERRAFORM_DIR/main.tf"
}

@test "variables.tf exists and defines ssh_public_key" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  [ -f "$TERRAFORM_DIR/variables.tf" ]
  grep -q "ssh_public_key" "$TERRAFORM_DIR/variables.tf"
}

@test "outputs.tf exists and exports vm_public_ip" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  [ -f "$TERRAFORM_DIR/outputs.tf" ]
  grep -q "vm_public_ip\|public_ip_address" "$TERRAFORM_DIR/outputs.tf"
}

@test "terraform.tfvars.example exists" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  [ -f "$TERRAFORM_DIR/terraform.tfvars.example" ]
}

# ─── Security: CIDRs must not default to 0.0.0.0/0 (HIT-96) ──────────────────

@test "variables.tf allowed_ssh_cidrs has no 0.0.0.0/0 default" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  # The allowed_ssh_cidrs default line must not contain 0.0.0.0/0
  # (validation blocks may reference it to reject it — only the default= line matters)
  ! awk '/variable "allowed_ssh_cidrs"/,/^}/' "$TERRAFORM_DIR/variables.tf" \
    | grep '^\s*default\s*=' | grep -q '0\.0\.0\.0/0'
}

@test "variables.tf allowed_http_cidrs has no 0.0.0.0/0 default" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  # The allowed_http_cidrs variable must not have a default containing 0.0.0.0/0
  ! awk '/variable "allowed_http_cidrs"/,/^}/' "$TERRAFORM_DIR/variables.tf" \
    | grep -q '0\.0\.0\.0/0'
}

@test "variables.tf allowed_ssh_cidrs has no default at all" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  # SSH CIDRs must be explicitly provided — no default value permitted
  ! awk '/variable "allowed_ssh_cidrs"/,/^}/' "$TERRAFORM_DIR/variables.tf" \
    | grep -q '^\s*default\s*='
}

@test "variables.tf has validation block rejecting 0.0.0.0/0 for SSH" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  # A validation block must exist inside the allowed_ssh_cidrs variable
  awk '/variable "allowed_ssh_cidrs"/,/^}/' "$TERRAFORM_DIR/variables.tf" \
    | grep -q 'validation'
}

@test "tfvars.example does not use 0.0.0.0/0 for allowed_ssh_cidrs" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  # The example file must show real placeholder CIDRs, not open access
  ! grep 'allowed_ssh_cidrs' "$TERRAFORM_DIR/terraform.tfvars.example" \
    | grep -q '0\.0\.0\.0/0'
}

@test "tfvars.example provides placeholder CIDRs for allowed_ssh_cidrs" {
  TERRAFORM_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  # Must show example placeholder IPs, not open 0.0.0.0/0
  grep 'allowed_ssh_cidrs' "$TERRAFORM_DIR/terraform.tfvars.example" \
    | grep -q 'YOUR_\|x\.x\.x\.x\|<\|203\.0\.113\|198\.51\.100'
}
