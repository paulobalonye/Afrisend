# TDD: AWS Budgets alert tests

variables {
  vpc_id            = "vpc-00000000test00001"
  public_subnet_id  = "subnet-00000000test0001"
  private_rt_id     = "rtb-00000000test0001"
  environment       = "dev"
  key_name          = "test-key"
  notification_email = "devops@test.com"
  aws_account_id    = "123456789012"
}

# ── Budget limit must be $100/month ──────────────────────────────────────────
run "budget_limit_100_usd" {
  command = plan

  assert {
    condition     = aws_budgets_budget.dev_monthly.limit_amount == "100"
    error_message = "Budget limit must be 100 USD/month"
  }

  assert {
    condition     = aws_budgets_budget.dev_monthly.limit_unit == "USD"
    error_message = "Budget limit_unit must be USD"
  }

  assert {
    condition     = aws_budgets_budget.dev_monthly.time_unit == "MONTHLY"
    error_message = "Budget time_unit must be MONTHLY"
  }
}

# ── Must have 80% alert threshold ─────────────────────────────────────────────
run "budget_has_80_percent_alert" {
  command = plan

  assert {
    condition = anytrue([
      for n in aws_budgets_budget.dev_monthly.notification :
      n.threshold == 80 && n.threshold_type == "PERCENTAGE"
    ])
    error_message = "Budget must have an 80% ACTUAL spend notification"
  }
}

# ── Must have 100% alert threshold ────────────────────────────────────────────
run "budget_has_100_percent_alert" {
  command = plan

  assert {
    condition = anytrue([
      for n in aws_budgets_budget.dev_monthly.notification :
      n.threshold == 100 && n.threshold_type == "PERCENTAGE"
    ])
    error_message = "Budget must have a 100% ACTUAL spend notification"
  }
}

# ── Both alerts must notify via email ────────────────────────────────────────
run "budget_alerts_notify_email" {
  command = plan

  assert {
    condition = alltrue([
      for n in aws_budgets_budget.dev_monthly.notification :
      anytrue([for sub in n.subscriber_email_addresses : length(sub) > 0])
    ])
    error_message = "All budget notifications must have at least one email subscriber"
  }
}
