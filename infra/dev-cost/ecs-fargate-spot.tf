# ────────────────────────────────────────────────────────────────────────────
# ECS Fargate Spot — dev capacity provider strategy
#
# Savings: up to 70% on Fargate compute
# ────────────────────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "dev" {
  #checkov:skip=CKV_AWS_65:Container Insights intentionally disabled for dev (saves ~$5/mo in CloudWatch)
  name = var.ecs_cluster_name

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = {
    Name = var.ecs_cluster_name
  }
}

resource "aws_ecs_cluster_capacity_providers" "dev" {
  cluster_name       = aws_ecs_cluster.dev.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 3
    base              = 1
  }

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 0
  }
}
