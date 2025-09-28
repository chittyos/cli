# ChittyOS Infrastructure Variables

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Primary domain name for ChittyOS services"
  type        = string
  default     = "chitty.cc"
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for domain"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

# Networking
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access services"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# Database
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

# R2 Storage
variable "r2_bucket_name" {
  description = "Cloudflare R2 bucket name"
  type        = string
  default     = "chittyos-storage"
}

# ChittyID Service Configuration
variable "chittyid_cpu" {
  description = "CPU units for ChittyID service"
  type        = number
  default     = 256
}

variable "chittyid_memory" {
  description = "Memory MB for ChittyID service"
  type        = number
  default     = 512
}

# ChittyMCP Configuration
variable "chittymcp_cpu" {
  description = "CPU units for ChittyMCP service"
  type        = number
  default     = 512
}

variable "chittymcp_memory" {
  description = "Memory MB for ChittyMCP service"
  type        = number
  default     = 1024
}

# Monitoring
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "notification_email" {
  description = "Email for alerts and notifications"
  type        = string
  default     = "alerts@chitty.cc"
}

# ChittyOS Framework Configuration
variable "framework_config" {
  description = "ChittyOS framework configuration"
  type = object({
    version           = string
    compliance_level  = string
    enable_monitoring = bool
    enable_security   = bool
  })
  default = {
    version           = "1.0.1"
    compliance_level  = "100%"
    enable_monitoring = true
    enable_security   = true
  }
}