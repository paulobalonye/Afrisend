output "nat_instance_id" {
  description = "EC2 instance ID of the NAT instance"
  value       = aws_instance.nat.id
}

output "nat_eip" {
  description = "Elastic IP attached to the NAT instance"
  value       = aws_eip.nat.public_ip
}

output "nat_security_group_id" {
  description = "Security group ID for the NAT instance"
  value       = aws_security_group.nat.id
}

output "rds_endpoint" {
  description = "RDS instance connection endpoint"
  value       = aws_db_instance.dev.endpoint
}

output "rds_identifier" {
  description = "RDS instance identifier"
  value       = aws_db_instance.dev.identifier
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster with Fargate Spot capacity providers"
  value       = aws_ecs_cluster.dev.arn
}

output "budget_sns_topic_arn" {
  description = "SNS topic ARN for budget alerts"
  value       = aws_sns_topic.budget_alerts.arn
}
