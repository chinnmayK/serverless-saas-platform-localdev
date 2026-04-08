########################################################
# DOCUMENTDB SUBNET GROUP
########################################################

resource "aws_docdb_subnet_group" "main" {
  name       = "${var.project_name}-docdb-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.project_name}-docdb-subnet-group"
  }
}

########################################################
# DOCUMENTDB SECURITY GROUP
########################################################

resource "aws_security_group" "docdb_sg" {
  name        = "${var.project_name}-docdb-sg"
  description = "Allow DocumentDB access from ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 27017
    to_port         = 27017
    protocol        = "tcp"
    security_groups = [var.ecs_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-docdb-sg"
  }
}

########################################################
# DOCUMENTDB CLUSTER
########################################################

resource "aws_docdb_cluster" "main" {
  cluster_identifier      = "${var.project_name}-docdb-cluster"
  engine                  = "docdb"
  master_username         = "docdbadmin"
  master_password         = var.db_password
  backup_retention_period = 5
  preferred_backup_window = "07:00-09:00"
  skip_final_snapshot     = true
  db_subnet_group_name    = aws_docdb_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.docdb_sg.id]

  storage_encrypted = true

  tags = {
    Name = "${var.project_name}-docdb-cluster"
  }
}

########################################################
# DOCUMENTDB CLUSTER INSTANCE
########################################################

resource "aws_docdb_cluster_instance" "cluster_instances" {
  count              = 1
  identifier         = "${var.project_name}-docdb-instance-${count.index}"
  cluster_identifier = aws_docdb_cluster.main.id
  instance_class     = "db.t3.medium"

  tags = {
    Name = "${var.project_name}-docdb-instance"
  }
}
