# AfriSend Azure Dev Deployment

Single Azure VM (Standard_B2s) running all AfriSend services via Docker Compose.

## Architecture

```
Internet
    │
    ▼
Azure VM (Standard_B2s — 2 vCPU, 4 GiB RAM)
    │
    ├── Kong :8000 (proxy — QA access)
    ├── Backend :3000 (internal only)
    ├── PostgreSQL :5432 (internal only)
    ├── Redis :6379 (internal only)
    ├── Grafana :3001 (monitoring)
    └── Prometheus :9090 (metrics)
```

**Monthly cost estimate: ~$44-49/mo**

| Resource | SKU | Estimated Cost |
|----------|-----|----------------|
| VM (Standard_B2s) | 2 vCPU, 4 GiB | ~$30-35/mo |
| OS Disk (Premium LRS 64 GiB) | — | ~$10/mo |
| Public IP (Static, Standard) | — | ~$4/mo |

## Prerequisites

1. Azure CLI installed and authenticated (`az login`)
2. Terraform >= 1.5 installed
3. An SSH key pair (`ssh-keygen -t rsa -b 4096`)
4. GitHub repo with required secrets configured (see CI/CD section)

## Initial Setup

### 1. Provision VM with Terraform

```bash
cd infra/azure-dev
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set ssh_public_key and restrict allowed_ssh_cidrs

terraform init
terraform plan
terraform apply
```

Note the outputs:

```bash
terraform output vm_public_ip      # VM IP — needed for deploy.sh
terraform output ssh_command       # Ready-to-paste SSH command
terraform output kong_proxy_url    # QA access URL
```

### 2. Wait for cloud-init to complete

Cloud-init installs Docker automatically on first boot (~3-5 minutes). Check progress:

```bash
ssh azureuser@<VM_IP> "cloud-init status --wait"
```

If cloud-init is unavailable or failed, run the bootstrap script manually:

```bash
ssh azureuser@<VM_IP> 'bash -s' < infra/azure-dev/scripts/bootstrap-vm.sh
```

### 3. Deploy the stack

```bash
cp .env.example .env.azure-dev
# Edit .env.azure-dev with your dev API keys

VM_IP=$(terraform -chdir=infra/azure-dev output -raw vm_public_ip)
VM_IP=$VM_IP ENV_FILE=.env.azure-dev ./infra/azure-dev/scripts/deploy.sh
```

### 4. Verify

```bash
# Health check via Kong proxy
curl http://<VM_IP>:8000/health

# View running services
ssh azureuser@<VM_IP> "cd /opt/afrisend && docker compose ps"

# View logs
ssh azureuser@<VM_IP> "cd /opt/afrisend && docker compose logs --tail=50 backend"
```

## CI/CD Pipeline

The `.github/workflows/deploy-azure-dev.yml` workflow deploys automatically on every push to `main` (when relevant files change) and can be triggered manually.

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AZURE_DEV_SSH_PRIVATE_KEY` | SSH private key for VM access |
| `YC_PUBKEY_DEV` | YellowCard public key (sandbox) |
| `YC_SECRET_DEV` | YellowCard secret (sandbox) |
| `VERIFF_PKEY` | Veriff public key |
| `VERIFF_SKEY` | Veriff secret key |
| `RESEND_API_KEY` | Resend email API key |
| `FLW_PUBLIC_KEY` | Flutterwave public key |
| `FLW_SECRET_KEY` | Flutterwave secret key |
| `FLW_ENCRYPTION_KEY` | Flutterwave encryption key |
| `STRIPE_SECRET_KEY_DEV` | Stripe secret key (test mode) |
| `STRIPE_WEBHOOK_SECRET_DEV` | Stripe webhook secret (test mode) |
| `GRAFANA_ADMIN_PASSWORD_DEV` | Grafana admin password |

### Required GitHub Variables

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `AZURE_DEV_VM_IP` | `20.1.2.3` | VM public IP from Terraform |
| `YC_BASEURL_DEV` | `https://sandbox.api.yellowcard.io` | YellowCard sandbox URL |
| `YC_MERCHANTID_DEV` | `...` | YellowCard merchant ID |
| `RESEND_DOMAIN` | `afrisend.io` | Email sending domain |
| `STRIPE_PUBLISHABLE_KEY_DEV` | `pk_test_...` | Stripe publishable key |

### Manual Deploy

```bash
gh workflow run deploy-azure-dev.yml
# or with force:
gh workflow run deploy-azure-dev.yml -f force_deploy=true
```

## Accessing Services

| Service | URL | Notes |
|---------|-----|-------|
| Kong API Proxy | `http://<VM_IP>:8000` | All API traffic — share with QA |
| Grafana | `http://<VM_IP>:3001` | Default: admin / afrisend_grafana_dev |
| Prometheus | `http://<VM_IP>:9090` | Metrics — restricted to SSH CIDRs |
| Kong Admin API | `127.0.0.1:8001` | SSH tunnel only — not public |

## Useful Operations

```bash
# SSH to VM
ssh azureuser@<VM_IP>

# View all service logs
cd /opt/afrisend && docker compose logs -f

# Restart a specific service
docker compose restart backend

# Pull latest images and redeploy
docker compose -f docker-compose.yml -f docker-compose.azure-dev.yml pull
docker compose -f docker-compose.yml -f docker-compose.azure-dev.yml up -d --remove-orphans

# Run database migrations manually
docker compose exec backend node dist/server/db/migrate.js

# View resource usage
docker stats
```

## Teardown

To destroy all Azure resources:

```bash
cd infra/azure-dev
terraform destroy
```

This destroys the VM, disk, public IP, VNet, NSG, and resource group.
**All data stored on the VM will be lost.**
