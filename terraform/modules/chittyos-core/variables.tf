# ChittyOS Core Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "name_prefix" {
  description = "Name prefix for resources"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
}

variable "ecs_cluster_name" {
  description = "ECS cluster name"
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
}

variable "db_allocated_storage" {
  description = "RDS allocated storage"
  type        = number
}

variable "r2_bucket_name" {
  description = "R2 bucket name"
  type        = string
}

variable "chittyid_service_config" {
  description = "ChittyID service configuration"
  type = object({
    cpu    = number
    memory = number
    port   = number
  })
}

variable "chittymcp_config" {
  description = "ChittyMCP configuration"
  type = object({
    cpu    = number
    memory = number
    port   = number
  })
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}