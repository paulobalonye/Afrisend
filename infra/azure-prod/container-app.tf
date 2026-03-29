# ─── Container Apps Environment ───────────────────────────────────────────────

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${local.resource_prefix}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  tags = local.tags
}

# ─── Container App (API Backend) ─────────────────────────────────────────────

resource "azurerm_container_app" "api" {
  name                         = "ca-${local.resource_prefix}-api"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  template {
    min_replicas = var.container_min_replicas
    max_replicas = var.container_max_replicas

    container {
      name   = "afrisend-api"
      image  = var.container_image
      cpu    = var.container_cpu
      memory = var.container_memory

      # ── Core Config ──────────────────────────────────────────────────────
      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "PORT"
        value = "3000"
      }

      # ── Database ─────────────────────────────────────────────────────────
      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }

      # ── Redis ────────────────────────────────────────────────────────────
      env {
        name        = "REDIS_URL"
        secret_name = "redis-url"
      }

      # ── YellowCard ──────────────────────────────────────────────────────
      env {
        name        = "YC_PUBKEY"
        secret_name = "yc-pubkey"
      }

      env {
        name        = "YC_SECRET"
        secret_name = "yc-secret"
      }

      env {
        name  = "YC_BASEURL"
        value = var.yellowcard_base_url
      }

      env {
        name        = "YC_MERCHANTID"
        secret_name = "yc-merchantid"
      }

      # ── Veriff (KYC) ────────────────────────────────────────────────────
      env {
        name        = "VERIFF_PKEY"
        secret_name = "veriff-pkey"
      }

      env {
        name        = "VERIFF_SKEY"
        secret_name = "veriff-skey"
      }

      # ── Resend (Email) ──────────────────────────────────────────────────
      env {
        name        = "RESEND_API_KEY"
        secret_name = "resend-api-key"
      }

      env {
        name  = "RESEND_DOMAIN"
        value = "afrisend.com"
      }

      # ── Flutterwave ─────────────────────────────────────────────────────
      env {
        name        = "FLW_PUBLIC_KEY"
        secret_name = "flw-public-key"
      }

      env {
        name        = "FLW_SECRET_KEY"
        secret_name = "flw-secret-key"
      }

      env {
        name        = "FLW_ENCRYPTION_KEY"
        secret_name = "flw-encryption-key"
      }

      # ── Stripe ───────────────────────────────────────────────────────────
      env {
        name        = "STRIPE_SECRET_KEY"
        secret_name = "stripe-secret-key"
      }

      env {
        name        = "STRIPE_PUBLISHABLE_KEY"
        secret_name = "stripe-publishable-key"
      }

      env {
        name        = "STRIPE_WEBHOOK_SECRET"
        secret_name = "stripe-webhook-secret"
      }

      # ── MFA Encryption ──────────────────────────────────────────────────
      env {
        name        = "MFA_ENCRYPTION_KEY"
        secret_name = "mfa-encryption-key"
      }

      # ── Smile Identity (KYC) ────────────────────────────────────────────
      env {
        name        = "SMILE_IDENTITY_API_KEY"
        secret_name = "smile-identity-api-key"
      }

      env {
        name        = "SMILE_IDENTITY_PARTNER_ID"
        secret_name = "smile-identity-partner-id"
      }

      env {
        name        = "SMILE_IDENTITY_WEBHOOK_SECRET"
        secret_name = "smile-identity-webhook-secret"
      }

      # ── Health Check ─────────────────────────────────────────────────────
      liveness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 3000

        initial_delay    = 10
        interval_seconds = 30
        timeout          = 5
        failure_count_threshold = 3
      }

      readiness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 3000

        interval_seconds = 10
        timeout          = 5
        failure_count_threshold = 3
      }
    }

    # HTTP scaling rule
    http_scale_rule {
      name                = "http-scaling"
      concurrent_requests = "50"
    }
  }

  # ── Secrets (values set via Azure CLI or CI/CD, not in Terraform state) ────
  secret {
    name  = "database-url"
    value = "postgresql://${azurerm_postgresql_flexible_server.main.administrator_login}:${random_password.postgres.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.app.name}?sslmode=require"
  }

  secret {
    name  = "redis-url"
    value = "rediss://:${azurerm_redis_cache.main.primary_access_key}@${azurerm_redis_cache.main.hostname}:${azurerm_redis_cache.main.ssl_port}"
  }

  # Placeholder secrets — update via `az containerapp secret set` after deploy
  secret {
    name  = "yc-pubkey"
    value = "CHANGE_ME"
  }

  secret {
    name  = "yc-secret"
    value = "CHANGE_ME"
  }

  secret {
    name  = "yc-merchantid"
    value = "CHANGE_ME"
  }

  secret {
    name  = "veriff-pkey"
    value = "CHANGE_ME"
  }

  secret {
    name  = "veriff-skey"
    value = "CHANGE_ME"
  }

  secret {
    name  = "resend-api-key"
    value = "CHANGE_ME"
  }

  secret {
    name  = "flw-public-key"
    value = "CHANGE_ME"
  }

  secret {
    name  = "flw-secret-key"
    value = "CHANGE_ME"
  }

  secret {
    name  = "flw-encryption-key"
    value = "CHANGE_ME"
  }

  secret {
    name  = "stripe-secret-key"
    value = "CHANGE_ME"
  }

  secret {
    name  = "stripe-publishable-key"
    value = "CHANGE_ME"
  }

  secret {
    name  = "stripe-webhook-secret"
    value = "CHANGE_ME"
  }

  secret {
    name  = "mfa-encryption-key"
    value = "CHANGE_ME"
  }

  secret {
    name  = "smile-identity-api-key"
    value = "CHANGE_ME"
  }

  secret {
    name  = "smile-identity-partner-id"
    value = "CHANGE_ME"
  }

  secret {
    name  = "smile-identity-webhook-secret"
    value = "CHANGE_ME"
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    transport        = "http"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = local.tags
}
