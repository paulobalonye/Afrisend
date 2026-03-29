# AfriSend Azure Production Deployment

## Architecture

```
Internet → Azure Container Apps (API) → PostgreSQL Flexible Server
                                      → Azure Cache for Redis
```

**Monthly cost target: ~$45-50/mo**

| Resource | SKU | Estimated Cost |
|----------|-----|---------------|
| Container Apps (0.5 vCPU, 1Gi) | Consumption | ~$10-15/mo |
| PostgreSQL Flexible Server | B_Standard_B1ms | ~$13/mo |
| Azure Cache for Redis | Basic C0 | ~$16/mo |
| Log Analytics (30-day) | PerGB2018 | ~$2-5/mo |

## Prerequisites

1. Azure CLI installed and authenticated (`az login`)
2. Terraform >= 1.5 installed
3. GitHub repository with `AZURE_CREDENTIALS` secret configured

### Create Azure Service Principal

```bash
az ad sp create-for-rbac \
  --name "afrisend-deploy" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/rg-afrisend-prod \
  --sdk-auth
```

Save the JSON output as `AZURE_CREDENTIALS` in GitHub repo secrets.

## Initial Deployment

### 1. Provision Infrastructure

```bash
cd infra/azure-prod
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

terraform init
terraform plan
terraform apply
```

### 2. Set API Secrets

After infrastructure is provisioned, set the real API keys:

```bash
export AFRISEND_ENV_FILE=/path/to/.env.production
./scripts/setup-secrets.sh
```

Or set individual secrets:

```bash
az containerapp secret set \
  --name ca-afrisend-prod-api \
  --resource-group rg-afrisend-prod \
  yc-pubkey=<value> \
  yc-secret=<value>
```

### 3. Run Database Migrations

```bash
# Get the DATABASE_URL from Terraform output
terraform output -raw postgres_fqdn

# Run migrations (from project root)
DATABASE_URL="postgresql://afrisend_admin:<password>@<fqdn>:5432/afrisend_prod?sslmode=require" \
  npm run db:migrate
```

### 4. Verify Deployment

```bash
# Get the app URL
terraform output container_app_url

# Test health endpoint
curl https://<app-fqdn>/health
```

## CI/CD Pipeline

The `.github/workflows/deploy-azure-prod.yml` workflow:

1. **Triggers** on push to `main` (when API code changes) or manual dispatch
2. **Builds** Docker image from `apps/api/Dockerfile`
3. **Pushes** to GitHub Container Registry (ghcr.io)
4. **Deploys** to Azure Container Apps
5. **Verifies** health check passes
6. **Alerts** on failure with rollback guidance

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | Service principal JSON from `az ad sp create-for-rbac` |

### Manual Deployment

Trigger via GitHub Actions UI or:

```bash
gh workflow run deploy-azure-prod.yml -f image_tag=<specific-tag>
```

## Custom Domain Setup

1. Add a CNAME record pointing your domain to the Container App FQDN
2. Configure in Terraform:
   ```hcl
   custom_domain = "api.afrisend.com"
   ```
3. Run `terraform apply` — Azure handles TLS certificate provisioning

## Monitoring

- **Logs**: Azure Portal → Container Apps → Log stream, or:
  ```bash
  az containerapp logs show \
    --name ca-afrisend-prod-api \
    --resource-group rg-afrisend-prod \
    --follow
  ```

- **Metrics**: Azure Portal → Container Apps → Metrics (CPU, memory, requests)

- **Log Analytics**: KQL queries in the Log Analytics Workspace

## Rollback

```bash
# List revisions
az containerapp revision list \
  --name ca-afrisend-prod-api \
  --resource-group rg-afrisend-prod

# Activate a previous revision
az containerapp revision activate \
  --name ca-afrisend-prod-api \
  --resource-group rg-afrisend-prod \
  --revision <revision-name>
```
