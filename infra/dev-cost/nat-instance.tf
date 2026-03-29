# ────────────────────────────────────────────────────────────────────────────
# NAT Instance (replaces NAT Gateway — saves ~$32/month)
# ────────────────────────────────────────────────────────────────────────────

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

resource "aws_security_group" "nat" {
  #checkov:skip=CKV_AWS_382:Egress all is required — NAT SG must pass through all traffic to internet
  name        = "afrisend-${var.environment}-nat-instance"
  description = "Allow HTTP/HTTPS from VPC; all outbound"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP from VPC"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  egress {
    description = "All outbound - required for NAT forwarding"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "afrisend-${var.environment}-nat-sg"
  }
}

resource "aws_iam_role" "nat_ssm" {
  name = "afrisend-${var.environment}-nat-ssm"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "nat_ssm" {
  role       = aws_iam_role.nat_ssm.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "nat_ssm" {
  name = "afrisend-${var.environment}-nat-ssm"
  role = aws_iam_role.nat_ssm.name
}

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "afrisend-${var.environment}-nat-eip"
  }
}

resource "aws_eip_association" "nat" {
  instance_id   = aws_instance.nat.id
  allocation_id = aws_eip.nat.id
}

resource "aws_instance" "nat" {
  #checkov:skip=CKV_AWS_135:t3.nano does not support EBS-optimized flag (it is always EBS-optimized at no extra charge)
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t3.nano"
  subnet_id              = var.public_subnet_id
  vpc_security_group_ids = [aws_security_group.nat.id]
  iam_instance_profile   = aws_iam_instance_profile.nat_ssm.name
  source_dest_check      = false   # REQUIRED: packet forwarding for NAT

  key_name = var.key_name != "" ? var.key_name : null

  # IMDSv2 enforced (CKV_AWS_79)
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    http_endpoint               = "enabled"
  }

  # EBS root volume encrypted (CKV_AWS_8)
  root_block_device {
    encrypted   = true
    volume_type = "gp3"
    volume_size = 8
  }

  # Detailed monitoring (CKV_AWS_126) — minimal cost, useful for auto-stop triggers
  monitoring = true

  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -euo pipefail

    # Enable IP forwarding
    echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
    sysctl -p

    # iptables NAT masquerade
    yum install -y iptables-services
    iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
    service iptables save
    systemctl enable iptables
    systemctl start iptables

    systemctl enable amazon-ssm-agent
    systemctl start amazon-ssm-agent
  EOF
  )

  tags = {
    Name     = "afrisend-${var.environment}-nat"
    AutoStop = "true"
  }

  lifecycle {
    ignore_changes = [ami]
  }
}

resource "aws_route" "private_nat" {
  route_table_id         = var.private_rt_id
  destination_cidr_block = "0.0.0.0/0"
  network_interface_id   = aws_instance.nat.primary_network_interface_id

  lifecycle {
    create_before_destroy = true
  }
}
