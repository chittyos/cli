# ChittyOS Core Module Outputs

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB zone ID"
  value       = aws_lb.main.zone_id
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "chittyid_endpoint" {
  description = "ChittyID service endpoint"
  value       = aws_lb.main.dns_name
}

output "chittymcp_endpoint" {
  description = "ChittyMCP service endpoint"
  value       = aws_lb.main.dns_name
}

output "db_endpoint" {
  description = "Database endpoint"
  value       = "db.${var.environment}.chitty.cc"
}

output "db_port" {
  description = "Database port"
  value       = 5432
}