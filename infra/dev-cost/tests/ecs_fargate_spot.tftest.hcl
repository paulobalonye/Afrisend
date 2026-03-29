# TDD: ECS Fargate Spot tests

variables {
  vpc_id            = "vpc-00000000test00001"
  public_subnet_id  = "subnet-00000000test0001"
  private_rt_id     = "rtb-00000000test0001"
  environment       = "dev"
  key_name          = "test-key"
  notification_email = "devops@test.com"
  aws_account_id    = "123456789012"
  ecs_cluster_name  = "afrisend-dev"
  ecs_service_name  = "afrisend-backend"
  task_definition_arn = "arn:aws:ecs:us-east-1:123456789012:task-definition/afrisend:1"
  private_subnet_ids = ["subnet-00000000test0002"]
  ecs_sg_id         = "sg-00000000test0001"
}

# ── ECS cluster must have FARGATE_SPOT as primary capacity provider ───────────
run "ecs_uses_fargate_spot_primary" {
  command = plan

  assert {
    condition = anytrue([
      for cp in aws_ecs_cluster_capacity_providers.dev.capacity_providers :
      cp == "FARGATE_SPOT"
    ])
    error_message = "ECS cluster must include FARGATE_SPOT capacity provider"
  }
}

# ── FARGATE_SPOT must have highest base weight ────────────────────────────────
run "ecs_fargate_spot_highest_weight" {
  command = plan

  assert {
    condition = anytrue([
      for cpstrat in aws_ecs_cluster_capacity_providers.dev.default_capacity_provider_strategy :
      cpstrat.capacity_provider == "FARGATE_SPOT" && cpstrat.weight >= 3
    ])
    error_message = "FARGATE_SPOT must have weight >= 3 so it is preferred over FARGATE"
  }
}

# ── FARGATE must remain as fallback ──────────────────────────────────────────
run "ecs_fargate_fallback_present" {
  command = plan

  assert {
    condition = anytrue([
      for cp in aws_ecs_cluster_capacity_providers.dev.capacity_providers :
      cp == "FARGATE"
    ])
    error_message = "FARGATE must remain as fallback capacity provider"
  }
}
