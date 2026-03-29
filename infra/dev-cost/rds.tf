# ────────────────────────────────────────────────────────────────────────────
# RDS Dev Instance — Right-sized to db.t3.micro
#
# Savings: $10–30/month vs larger instances
# ────────────────────────────────────────────────────────────────────────────

resource "aws_security_group" "rds" {
  #checkov:skip=CKV_AWS_382:Egress restriction is not meaningful for RDS SG; keep all-egress for simplicity
  name        = "afrisend-${var.environment}-rds"
  description = "Allow PostgreSQL access from within VPC"
  vpc_id      = var.vpc_id

  ingress {
    description = "PostgreSQL from VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "afrisend-${var.environment}-rds-sg"
  }
}

# Parameter group to enable PostgreSQL query logging (CKV2_AWS_30)
resource "aws_db_parameter_group" "dev_pg15" {
  name        = "afrisend-${var.environment}-pg15"
  family      = "postgres15"
  description = "Dev parameter group with query logging enabled"

  parameter {
    name  = "log_statement"
    value = "ddl"  # Log DDL statements — lighter than "all" for dev
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # Log queries >1s
  }

  # Require SSL/TLS for all connections (CKV2_AWS_69)
  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }
}

resource "aws_db_instance" "dev" {
  #checkov:skip=CKV_AWS_157:Single-AZ is intentional for dev (multi-AZ doubles cost)
  #checkov:skip=CKV_AWS_293:Deletion protection intentionally off for dev (fast teardown)
  #checkov:skip=CKV_AWS_353:Performance Insights adds ~$5/mo overhead — skipped for dev
  #checkov:skip=CKV_AWS_118:Enhanced monitoring adds cost overhead — skipped for dev
  identifier        = "afrisend-${var.environment}"
  engine            = "postgres"
  engine_version    = "15"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  storage_type      = "gp2"
  storage_encrypted = true   # Free feature — always encrypt at rest (CKV_AWS_16)

  db_name  = "afrisend_dev"
  username = "afrisend"
  password = var.db_password

  db_subnet_group_name   = var.db_subnet_group_name != "" ? var.db_subnet_group_name : null
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.dev_pg15.name

  iam_database_authentication_enabled = true  # CKV_AWS_161

  multi_az                = false    # Intentional: Single-AZ saves ~50% for dev
  publicly_accessible     = false
  skip_final_snapshot     = true
  deletion_protection     = false    # Dev: allow easy teardown
  backup_retention_period = 1
  apply_immediately       = true

  auto_minor_version_upgrade = true   # CKV_AWS_226
  copy_tags_to_snapshot      = true   # CKV2_AWS_60

  enabled_cloudwatch_logs_exports = ["postgresql"]  # CKV_AWS_129

  tags = {
    Name     = "afrisend-${var.environment}-rds"
    AutoStop = "true"
  }
}
