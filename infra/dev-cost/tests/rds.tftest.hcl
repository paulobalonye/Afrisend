# TDD: RDS right-sizing tests

variables {
  vpc_id            = "vpc-00000000test00001"
  public_subnet_id  = "subnet-00000000test0001"
  private_rt_id     = "rtb-00000000test0001"
  environment       = "dev"
  key_name          = "test-key"
  notification_email = "devops@test.com"
  aws_account_id    = "123456789012"
  db_subnet_group_name = "test-subnet-group"
  db_password       = "TestPassword123!"
}

# ── RDS must use db.t3.micro (cheapest viable instance) ──────────────────────
run "rds_uses_t3_micro" {
  command = plan

  assert {
    condition     = aws_db_instance.dev.instance_class == "db.t3.micro"
    error_message = "RDS dev instance must be db.t3.micro (was ${aws_db_instance.dev.instance_class})"
  }
}

# ── RDS must be single-AZ for dev ─────────────────────────────────────────────
run "rds_single_az" {
  command = plan

  assert {
    condition     = aws_db_instance.dev.multi_az == false
    error_message = "Dev RDS must be single-AZ (multi-AZ doubles cost)"
  }
}

# ── RDS storage must be ≤20 GB gp2 ───────────────────────────────────────────
run "rds_max_20gb_storage" {
  command = plan

  assert {
    condition     = aws_db_instance.dev.allocated_storage <= 20
    error_message = "Dev RDS allocated_storage must be ≤20 GB (was ${aws_db_instance.dev.allocated_storage})"
  }

  assert {
    condition     = aws_db_instance.dev.storage_type == "gp2"
    error_message = "Dev RDS storage_type must be gp2"
  }
}

# ── RDS must have skip_final_snapshot true (dev convenience + avoids costs) ──
run "rds_skip_final_snapshot" {
  command = plan

  assert {
    condition     = aws_db_instance.dev.skip_final_snapshot == true
    error_message = "Dev RDS must set skip_final_snapshot = true"
  }
}
