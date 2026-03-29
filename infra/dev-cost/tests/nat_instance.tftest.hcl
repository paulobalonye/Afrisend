# TDD: NAT Instance tests — must pass before implementation is done
# These tests validate that the NAT instance configuration meets cost-optimization requirements.

variables {
  vpc_id            = "vpc-00000000test00001"
  public_subnet_id  = "subnet-00000000test0001"
  private_rt_id     = "rtb-00000000test0001"
  environment       = "dev"
  key_name          = "test-key"
  notification_email = "devops@test.com"
  aws_account_id    = "123456789012"
}

# ── NAT instance must use t3.nano (cheapest viable instance) ─────────────────
run "nat_instance_uses_t3_nano" {
  command = plan

  assert {
    condition     = aws_instance.nat.instance_type == "t3.nano"
    error_message = "NAT instance must be t3.nano to minimise cost (was ${aws_instance.nat.instance_type})"
  }
}

# ── NAT instance must disable source/dest check so it can route traffic ──────
run "nat_instance_source_dest_check_disabled" {
  command = plan

  assert {
    condition     = aws_instance.nat.source_dest_check == false
    error_message = "source_dest_check must be false on a NAT instance"
  }
}

# ── NAT instance must be in the public subnet ─────────────────────────────────
run "nat_instance_in_public_subnet" {
  command = plan

  assert {
    condition     = aws_instance.nat.subnet_id == var.public_subnet_id
    error_message = "NAT instance must be placed in the public subnet"
  }
}

# ── Private route table must route 0.0.0.0/0 via the NAT instance ────────────
run "private_rt_default_route_via_nat" {
  command = plan

  assert {
    condition     = aws_route.private_nat.route_table_id == var.private_rt_id
    error_message = "Default route must be attached to the private route table"
  }

  assert {
    condition     = aws_route.private_nat.destination_cidr_block == "0.0.0.0/0"
    error_message = "Route destination must be 0.0.0.0/0"
  }
}

# ── Security group must allow HTTP + HTTPS inbound from VPC ──────────────────
run "nat_sg_allows_http_https" {
  command = plan

  assert {
    condition     = length([
      for rule in aws_security_group.nat.ingress :
      rule if contains([80, 443], rule.from_port)
    ]) >= 2
    error_message = "NAT SG must allow inbound HTTP (80) and HTTPS (443)"
  }
}
