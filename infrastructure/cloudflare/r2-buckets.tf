###############################################################################
# GoFunnelAI â€” Cloudflare R2 buckets (Terraform, cloudflare provider v4.36+)
#
# Run order:
#   terraform init
#   terraform plan -var-file=prod.tfvars
#   terraform apply -var-file=prod.tfvars
#
# Required env:
#   CLOUDFLARE_API_TOKEN         scoped: Account / R2:Edit, Workers Scripts:Edit
#   CLOUDFLARE_ACCOUNT_ID        funnel-ai prod account
#
# This file provisions ALL R2 buckets the platform needs, plus the per-region
# replicas required for EU data-residency and Brazilian LGPD compliance.
###############################################################################

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.36"
    }
  }
  backend "remote" {
    organization = "funnel-ai"
    workspaces {
      prefix = "infra-r2-"
    }
  }
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account id (env CLOUDFLARE_ACCOUNT_ID)."
}

variable "environment" {
  type        = string
  description = "production | staging | preview"
  default     = "production"
  validation {
    condition     = contains(["production", "staging", "preview"], var.environment)
    error_message = "environment must be production | staging | preview"
  }
}

provider "cloudflare" {}

locals {
  # Suffix everything in staging/preview so we never collide with prod.
  suffix = var.environment == "production" ? "" : "-${var.environment}"

  # Region map â€” Cloudflare R2 uses jurisdictions, not raw regions, for
  # data-residency. "default" places in the closest of 4 storage hubs.
  jurisdictions = {
    us_default = "default"
    eu         = "eu"
    # Brazil currently rides on the default jurisdiction with a public-access
    # signed-CDN; LGPD compliance is implemented at the API layer via field
    # encryption + access control rather than at the storage layer.
  }
}

# -----------------------------------------------------------------------------
# Public asset bucket (rendered funnels, logos, images uploaded by users).
# Served via Cloudflare CDN through a worker route on assets.gofunnelai.com.
# -----------------------------------------------------------------------------
resource "cloudflare_r2_bucket" "funnel_assets" {
  account_id = var.cloudflare_account_id
  name       = "funnel-assets${local.suffix}"
  location   = local.jurisdictions.us_default
}

resource "cloudflare_r2_bucket" "funnel_assets_eu" {
  account_id = var.cloudflare_account_id
  name       = "funnel-assets-eu${local.suffix}"
  location   = local.jurisdictions.eu
}

resource "cloudflare_r2_bucket" "funnel_assets_br" {
  account_id = var.cloudflare_account_id
  name       = "funnel-assets-br${local.suffix}"
  location   = local.jurisdictions.us_default
}

# -----------------------------------------------------------------------------
# Audit reports (PDF) from the Grader. Private â€” accessed via signed URL only.
# -----------------------------------------------------------------------------
resource "cloudflare_r2_bucket" "funnel_audits" {
  account_id = var.cloudflare_account_id
  name       = "funnel-audits${local.suffix}"
  location   = local.jurisdictions.us_default
}

resource "cloudflare_r2_bucket" "funnel_audits_eu" {
  account_id = var.cloudflare_account_id
  name       = "funnel-audits-eu${local.suffix}"
  location   = local.jurisdictions.eu
}

# -----------------------------------------------------------------------------
# Lead-magnet downloads (PDFs, ebooks). Private â€” short-TTL signed URLs.
# -----------------------------------------------------------------------------
resource "cloudflare_r2_bucket" "funnel_leadmagnets" {
  account_id = var.cloudflare_account_id
  name       = "funnel-leadmagnets${local.suffix}"
  location   = local.jurisdictions.us_default
}

# -----------------------------------------------------------------------------
# RevTry voice call recordings. Highly sensitive â€” TLS, signed URLs only,
# encrypted at rest with CF-managed keys, retention enforced by lifecycle.
# -----------------------------------------------------------------------------
resource "cloudflare_r2_bucket" "funnel_recordings" {
  account_id = var.cloudflare_account_id
  name       = "funnel-recordings${local.suffix}"
  location   = local.jurisdictions.us_default
}

# -----------------------------------------------------------------------------
# Database + config backups. Versioned.
# -----------------------------------------------------------------------------
resource "cloudflare_r2_bucket" "funnel_backups" {
  account_id = var.cloudflare_account_id
  name       = "funnel-backups${local.suffix}"
  location   = local.jurisdictions.us_default
}

# -----------------------------------------------------------------------------
# Webhook bodies (raw, replay-able). 7-day TTL via custom lifecycle rule.
# -----------------------------------------------------------------------------
resource "cloudflare_r2_bucket" "funnel_webhook_bodies" {
  account_id = var.cloudflare_account_id
  name       = "funnel-webhook-bodies${local.suffix}"
  location   = local.jurisdictions.us_default
}

# -----------------------------------------------------------------------------
# Generation artifacts â€” intermediate agent outputs, kept 30d for debugging.
# -----------------------------------------------------------------------------
resource "cloudflare_r2_bucket" "funnel_generation_artifacts" {
  account_id = var.cloudflare_account_id
  name       = "funnel-generation-artifacts${local.suffix}"
  location   = local.jurisdictions.us_default
}

# -----------------------------------------------------------------------------
# Lifecycle rules â€” Cloudflare R2 supports object-expiration rules via the
# api/v4/accounts/{id}/r2/buckets/{name}/lifecycle endpoint. Terraform's
# cloudflare provider does not yet expose these directly, so we drive them
# through a null_resource that calls the Cloudflare API with a local-exec.
# -----------------------------------------------------------------------------
resource "null_resource" "lifecycle_recordings" {
  triggers = {
    bucket_id = cloudflare_r2_bucket.funnel_recordings.id
    rules     = "retention-365d"
  }

  provisioner "local-exec" {
    interpreter = ["bash", "-c"]
    command     = <<-EOT
      curl -fsS -X PUT \
        "https://api.cloudflare.com/client/v4/accounts/${var.cloudflare_account_id}/r2/buckets/${cloudflare_r2_bucket.funnel_recordings.name}/lifecycle" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
          "rules": [
            {
              "id": "expire-recordings-365d",
              "enabled": true,
              "conditions": { "prefix": "" },
              "deleteObjectsTransition": { "condition": { "type": "Age", "maxAge": 31536000 } }
            }
          ]
        }'
    EOT
  }
}

resource "null_resource" "lifecycle_webhook_bodies" {
  triggers = {
    bucket_id = cloudflare_r2_bucket.funnel_webhook_bodies.id
    rules     = "retention-7d"
  }

  provisioner "local-exec" {
    interpreter = ["bash", "-c"]
    command     = <<-EOT
      curl -fsS -X PUT \
        "https://api.cloudflare.com/client/v4/accounts/${var.cloudflare_account_id}/r2/buckets/${cloudflare_r2_bucket.funnel_webhook_bodies.name}/lifecycle" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
          "rules": [
            {
              "id": "expire-webhook-bodies-7d",
              "enabled": true,
              "conditions": { "prefix": "" },
              "deleteObjectsTransition": { "condition": { "type": "Age", "maxAge": 604800 } }
            }
          ]
        }'
    EOT
  }
}

resource "null_resource" "lifecycle_generation_artifacts" {
  triggers = {
    bucket_id = cloudflare_r2_bucket.funnel_generation_artifacts.id
    rules     = "retention-30d"
  }

  provisioner "local-exec" {
    interpreter = ["bash", "-c"]
    command     = <<-EOT
      curl -fsS -X PUT \
        "https://api.cloudflare.com/client/v4/accounts/${var.cloudflare_account_id}/r2/buckets/${cloudflare_r2_bucket.funnel_generation_artifacts.name}/lifecycle" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
          "rules": [
            {
              "id": "expire-generation-artifacts-30d",
              "enabled": true,
              "conditions": { "prefix": "" },
              "deleteObjectsTransition": { "condition": { "type": "Age", "maxAge": 2592000 } }
            }
          ]
        }'
    EOT
  }
}

# -----------------------------------------------------------------------------
# Public CDN binding for funnel-assets â€” managed bucket-level public access.
# -----------------------------------------------------------------------------
resource "cloudflare_r2_custom_domain" "assets_cdn" {
  count      = var.environment == "production" ? 1 : 0
  account_id = var.cloudflare_account_id
  bucket     = cloudflare_r2_bucket.funnel_assets.name
  domain     = "assets.gofunnelai.com"
  zone_id    = var.zone_id
  min_tls    = "1.2"
}

variable "zone_id" {
  type        = string
  description = "gofunnelai.com zone id (env CLOUDFLARE_ZONE_ID)"
  default     = ""
}

# -----------------------------------------------------------------------------
# Outputs â€” surfaced into the wrangler env config by the deploy script.
# -----------------------------------------------------------------------------
output "buckets" {
  value = {
    assets               = cloudflare_r2_bucket.funnel_assets.name
    assets_eu            = cloudflare_r2_bucket.funnel_assets_eu.name
    assets_br            = cloudflare_r2_bucket.funnel_assets_br.name
    audits               = cloudflare_r2_bucket.funnel_audits.name
    audits_eu            = cloudflare_r2_bucket.funnel_audits_eu.name
    leadmagnets          = cloudflare_r2_bucket.funnel_leadmagnets.name
    recordings           = cloudflare_r2_bucket.funnel_recordings.name
    backups              = cloudflare_r2_bucket.funnel_backups.name
    webhook_bodies       = cloudflare_r2_bucket.funnel_webhook_bodies.name
    generation_artifacts = cloudflare_r2_bucket.funnel_generation_artifacts.name
  }
}
