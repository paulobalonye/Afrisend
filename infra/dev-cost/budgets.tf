# ────────────────────────────────────────────────────────────────────────────
# AWS Budgets — $100/month guard-rail for dev
# Alerts at 80% (warning) and 100% (critical) via email + SNS
# ────────────────────────────────────────────────────────────────────────────

resource "aws_kms_key" "budget_sns" {
  description             = "KMS key for budget alert SNS topic"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowAccountRoot"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::${var.aws_account_id}:root" }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowSNS"
        Effect = "Allow"
        Principal = { Service = "sns.amazonaws.com" }
        Action   = ["kms:GenerateDataKey", "kms:Decrypt"]
        Resource = "*"
      },
      {
        Sid    = "AllowBudgets"
        Effect = "Allow"
        Principal = { Service = "budgets.amazonaws.com" }
        Action   = ["kms:GenerateDataKey", "kms:Decrypt"]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "afrisend-${var.environment}-budget-sns-key"
  }
}

resource "aws_kms_alias" "budget_sns" {
  name          = "alias/afrisend-${var.environment}-budget-sns"
  target_key_id = aws_kms_key.budget_sns.key_id
}

resource "aws_sns_topic" "budget_alerts" {
  name              = "afrisend-${var.environment}-budget-alerts"
  kms_master_key_id = aws_kms_key.budget_sns.arn  # CKV_AWS_26

  tags = {
    Name = "afrisend-${var.environment}-budget-alerts"
  }
}

resource "aws_sns_topic_subscription" "budget_email" {
  topic_arn = aws_sns_topic.budget_alerts.arn
  protocol  = "email"
  endpoint  = var.notification_email
}

resource "aws_sns_topic_policy" "budget_alerts" {
  arn = aws_sns_topic.budget_alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowBudgetsPublish"
        Effect = "Allow"
        Principal = { Service = "budgets.amazonaws.com" }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.budget_alerts.arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = var.aws_account_id
          }
        }
      }
    ]
  })
}

resource "aws_budgets_budget" "dev_monthly" {
  name         = "afrisend-dev-monthly-100usd"
  budget_type  = "COST"
  limit_amount = "100"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Environment$dev"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.notification_email]
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.notification_email]
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }
}
