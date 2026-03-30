# AfriSend Deployment Guide

## Azure Production Deployment

### Required GitHub Secrets

The Azure prod workflow (`deploy-azure-prod.yml`) requires **one** repository secret:

| Secret Name        | Description                                  |
|--------------------|----------------------------------------------|
| `AZURE_CREDENTIALS` | Full JSON credentials object (see format below) |

### AZURE_CREDENTIALS Format

Go to **Settings → Secrets and variables → Actions → New repository secret** and add:

**Name:** `AZURE_CREDENTIALS`

**Value** (JSON object — replace placeholder values):

```json
{
  "clientId": "<your-service-principal-client-id>",
  "clientSecret": "<your-service-principal-client-secret>",
  "tenantId": "<your-azure-tenant-id>",
  "subscriptionId": "<your-azure-subscription-id>"
}
```

> **Note:** The workflow uses `auth-type: CREDENTIALS_OBJECT` on `azure/login@v2`, which accepts
> the full JSON blob above. Do **not** use separate `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` secrets
> with this workflow.

### Creating the Service Principal

```bash
az ad sp create-for-rbac \
  --name "afrisend-prod-deploy" \
  --role "Contributor" \
  --scopes "/subscriptions/<subscription-id>/resourceGroups/rg-afrisend-prod" \
  --sdk-auth
```

The `--sdk-auth` flag outputs JSON in exactly the format needed for `AZURE_CREDENTIALS`.

### Triggering a Deployment

The workflow fires automatically on pushes to `main` that touch:

- `apps/api/**`
- `packages/shared/**`
- `Dockerfile.backend`
- `.github/workflows/deploy-azure-prod.yml`

You can also trigger it manually via **Actions → Deploy to Azure Production → Run workflow**.

## Staging Deployment

Staging uses AWS ECS. See `.github/workflows/deploy-staging.yml` for the required AWS secrets.
