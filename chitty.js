#!/usr/bin/env node

/**
 * ChittyCLI - Unified Command-Line Client
 * Enterprise Evidence Management with cutting-edge Cloudflare services
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import inquirer from "inquirer";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import os from "os";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const program = new Command();

// CLI Configuration
const CLI_VERSION = "1.0.0";
const API_BASE = process.env.CHITTY_API_BASE || "https://api.chittyos.com";
const API_KEY = process.env.CHITTY_API_KEY;

// Service configurations
const SERVICES = {
  pipelines: {
    validation: "chittyid-validation",
    evidence: "evidence-processing",
    monitoring: "real-time-monitoring",
  },
  containers: {
    evidenceProcessor: "evidence-processor:latest",
    aiAnalyzer: "ai-analyzer:gpu",
    ocrProcessor: "ocr-processor:v2",
  },
  regions: {
    us: "us-central1",
    eu: "eu-west1",
    apac: "asia-southeast1",
  },
};

// Utility functions
const logger = {
  info: (msg) => console.log(chalk.blue("ℹ"), msg),
  success: (msg) => console.log(chalk.green("✅"), msg),
  warn: (msg) => console.log(chalk.yellow("⚠"), msg),
  error: (msg) => console.log(chalk.red("❌"), msg),
  debug: (msg) => process.env.DEBUG && console.log(chalk.gray("🐛"), msg),
};

// API client
class ChittyAPI {
  constructor(baseUrl = API_BASE, apiKey = API_KEY) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": `ChittyCLI/${CLI_VERSION}`,
      ...options.headers,
    };

    logger.debug(`${options.method || "GET"} ${url}`);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error (${response.status}): ${error}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      logger.error(`API request failed: ${error.message}`);
      throw error;
    }
  }

  // Evidence management
  async uploadEvidence(file, chittyId, options = {}) {
    const formData = new FormData();
    const fileBuffer = await fs.readFile(file);
    const blob = new Blob([fileBuffer]);

    formData.append("file", blob, path.basename(file));
    formData.append("chittyId", chittyId);
    formData.append("metadata", JSON.stringify(options));

    return await this.request("/api/v1/evidence/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });
  }

  // Pipeline operations
  async triggerPipeline(pipelineType, data) {
    return await this.request(`/api/v1/pipeline/${pipelineType}/trigger`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getPipelineStatus(pipelineId) {
    return await this.request(`/api/v1/pipeline/${pipelineId}/status`);
  }

  // Container processing
  async processWithContainer(chittyId, file, processingType, options = {}) {
    const formData = new FormData();
    const fileBuffer = await fs.readFile(file);
    const blob = new Blob([fileBuffer]);

    formData.append("file", blob, path.basename(file));
    formData.append("chittyId", chittyId);
    formData.append("processingType", processingType);
    formData.append("options", JSON.stringify(options));

    return await this.request("/api/v1/container/process", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });
  }

  // Browser rendering
  async captureWebsite(chittyId, url, options = {}) {
    return await this.request("/api/v1/capture/web", {
      method: "POST",
      body: JSON.stringify({
        chittyId,
        url,
        options,
      }),
    });
  }

  // Image processing
  async processImage(chittyId, imagePath, options = {}) {
    const formData = new FormData();
    const fileBuffer = await fs.readFile(imagePath);
    const blob = new Blob([fileBuffer]);

    formData.append("image", blob, path.basename(imagePath));
    formData.append(
      "metadata",
      JSON.stringify({
        chittyId,
        ...options,
      }),
    );

    return await this.request("/api/v1/image/process", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });
  }

  // Privacy protection
  async protectPII(chittyId, data, options = {}) {
    return await this.request("/api/v1/privacy/protect", {
      method: "POST",
      body: JSON.stringify({
        chittyId,
        data,
        context: options,
      }),
    });
  }

  // Monitoring
  async getMetrics(timeRange = "1h") {
    return await this.request(`/api/v1/metrics?range=${timeRange}`);
  }

  async getHealth() {
    return await this.request("/health");
  }
}

const api = new ChittyAPI();

// ChittyID validation
function validateChittyID(chittyId) {
  const pattern =
    /^[0-9]{2}-[0-9]{1}-[A-Z]{3}-[0-9]{4}-[A-Z]{1}-[0-9]{6}-[0-9]{1}-[0-9]{1,2}$/;
  return pattern.test(chittyId);
}

function generateChittyID(entityType = "D") {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const sequence = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");

  return `01-1-USA-${year}-${entityType}-${year}${month}-1-${sequence.slice(-2)}`;
}

// Progress tracking
class ProgressTracker {
  constructor() {
    this.spinner = null;
    this.steps = [];
    this.current = 0;
  }

  start(message) {
    this.spinner = ora(message).start();
  }

  step(message) {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  succeed(message) {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    }
  }

  fail(message) {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  info(message) {
    if (this.spinner) {
      this.spinner.info(message);
    } else {
      logger.info(message);
    }
  }
}

// Command implementations
program
  .name("chitty")
  .description("ChittyCLI - Unified Command-Line Client\nAlias: ccli")
  .version(CLI_VERSION)
  .option("--yes", "Auto-approve prompts")
  .helpOption("-h, --help", "Show help");

// Evidence upload command
program
  .command("upload")
  .description("Upload evidence file with ChittyID")
  .argument("<chittyId>", "ChittyID for the evidence")
  .argument("<file>", "File path to upload")
  .option(
    "-t, --type <type>",
    "Evidence type (document, image, video)",
    "document",
  )
  .option("-r, --region <region>", "Storage region (us, eu, apac)", "us")
  .option("--redact-pii", "Enable PII redaction")
  .option("--ai-analysis", "Enable AI analysis")
  .option(
    "--priority <level>",
    "Processing priority (low, normal, high)",
    "normal",
  )
  .action(async (chittyId, file, options) => {
    const progress = new ProgressTracker();

    try {
      // Validate ChittyID
      if (!validateChittyID(chittyId)) {
        logger.error("Invalid ChittyID format");
        process.exit(1);
      }

      // Check file exists
      try {
        await fs.access(file);
      } catch {
        logger.error(`File not found: ${file}`);
        process.exit(1);
      }

      progress.start("Uploading evidence...");

      // Upload with options
      const uploadOptions = {
        type: options.type,
        region: options.region,
        redactPii: options.redactPii,
        aiAnalysis: options.aiAnalysis,
        priority: options.priority,
      };

      const result = await api.uploadEvidence(file, chittyId, uploadOptions);

      progress.succeed(`Evidence uploaded successfully`);

      // Display results
      const table = new Table({
        head: ["Property", "Value"],
        style: { head: ["cyan"] },
      });

      table.push(
        ["ChittyID", result.chittyId],
        ["Evidence ID", result.evidenceId],
        ["File Hash", result.fileHash],
        ["Storage Region", options.region],
        ["Processing Status", result.status || "Queued"],
      );

      console.log(table.toString());

      if (result.pipelineId) {
        logger.info(`Processing pipeline started: ${result.pipelineId}`);

        // Monitor pipeline if requested
        if (options.aiAnalysis) {
          progress.start("Running AI analysis...");
          await monitorPipeline(result.pipelineId, progress);
        }
      }
    } catch (error) {
      progress.fail(`Upload failed: ${error.message}`);
      process.exit(1);
    }
  });

// Web capture command
program
  .command("capture")
  .description("Capture web evidence")
  .argument("<chittyId>", "ChittyID for the capture")
  .argument("<url>", "URL to capture")
  .option("--pdf", "Generate PDF")
  .option("--full-page", "Full page screenshot")
  .option("--viewport <size>", "Viewport size (WxH)", "1920x1080")
  .option("--wait <ms>", "Wait time after load", "2000")
  .action(async (chittyId, url, options) => {
    const progress = new ProgressTracker();

    try {
      if (!validateChittyID(chittyId)) {
        logger.error("Invalid ChittyID format");
        process.exit(1);
      }

      // Parse viewport
      const [width, height] = options.viewport.split("x").map(Number);

      progress.start(`Capturing ${url}...`);

      const captureOptions = {
        includePdf: options.pdf,
        viewport: { width, height },
        waitTime: parseInt(options.wait),
        fullPage: options.fullPage,
      };

      const result = await api.captureWebsite(chittyId, url, captureOptions);

      progress.succeed("Web capture completed");

      const table = new Table({
        head: ["Property", "Value"],
        style: { head: ["cyan"] },
      });

      table.push(
        ["ChittyID", chittyId],
        ["Evidence ID", result.evidenceId],
        ["URL", url],
        ["Screenshot Size", `${(result.screenshotSize / 1024).toFixed(1)} KB`],
        [
          "PDF Size",
          result.pdfSize ? `${(result.pdfSize / 1024).toFixed(1)} KB` : "N/A",
        ],
        ["Metadata", `${Object.keys(result.metadata).length} fields`],
      );

      console.log(table.toString());
    } catch (error) {
      progress.fail(`Capture failed: ${error.message}`);
      process.exit(1);
    }
  });

// Container processing command
program
  .command("process")
  .description("Process evidence with containers")
  .argument("<chittyId>", "ChittyID for processing")
  .argument("<file>", "File to process")
  .option(
    "-t, --type <type>",
    "Processing type (ocr, ai-analysis, pdf-extract)",
    "ai-analysis",
  )
  .option("--gpu", "Use GPU acceleration")
  .option("--cpu <cores>", "CPU cores", "2")
  .option("--memory <size>", "Memory limit", "2Gi")
  .option("--redact-pii", "Enable PII redaction")
  .option("--timeout <seconds>", "Processing timeout", "300")
  .action(async (chittyId, file, options) => {
    const progress = new ProgressTracker();

    try {
      if (!validateChittyID(chittyId)) {
        logger.error("Invalid ChittyID format");
        process.exit(1);
      }

      try {
        await fs.access(file);
      } catch {
        logger.error(`File not found: ${file}`);
        process.exit(1);
      }

      progress.start("Starting container processing...");

      const processOptions = {
        gpu: options.gpu,
        resources: {
          cpu: options.cpu,
          memory: options.memory,
        },
        redactPii: options.redactPii,
        timeout: parseInt(options.timeout) * 1000,
      };

      const result = await api.processWithContainer(
        chittyId,
        file,
        options.type,
        processOptions,
      );

      progress.succeed("Container processing completed");

      const table = new Table({
        head: ["Property", "Value"],
        style: { head: ["cyan"] },
      });

      table.push(
        ["ChittyID", chittyId],
        ["Execution ID", result.executionId],
        ["Processing Type", options.type],
        ["Status", result.status],
        ["Processing Time", `${result.processingTime}ms`],
        [
          "Resources Used",
          `${result.resourceUsage?.cpu || "N/A"} CPU, ${result.resourceUsage?.memory || "N/A"} Memory`,
        ],
      );

      console.log(table.toString());

      if (result.output) {
        logger.info("Processing Results:");
        console.log(JSON.stringify(result.output, null, 2));
      }
    } catch (error) {
      progress.fail(`Processing failed: ${error.message}`);
      process.exit(1);
    }
  });

// Pipeline management commands
program.command("pipeline").description("Pipeline management commands");

program
  .command("pipeline:trigger")
  .description("Trigger a processing pipeline")
  .argument("<type>", "Pipeline type (validation, evidence, monitoring)")
  .argument("<chittyId>", "ChittyID to process")
  .option("-d, --data <data>", "Additional data (JSON string)")
  .action(async (type, chittyId, options) => {
    const progress = new ProgressTracker();

    try {
      if (!validateChittyID(chittyId)) {
        logger.error("Invalid ChittyID format");
        process.exit(1);
      }

      progress.start(`Triggering ${type} pipeline...`);

      const data = {
        chittyId,
        ...(options.data ? JSON.parse(options.data) : {}),
      };

      const result = await api.triggerPipeline(type, data);

      progress.succeed("Pipeline triggered successfully");

      logger.info(`Pipeline ID: ${result.pipelineId}`);
      logger.info(`Status: ${result.status}`);

      if (result.estimatedDuration) {
        logger.info(`Estimated duration: ${result.estimatedDuration}ms`);
      }
    } catch (error) {
      progress.fail(`Pipeline trigger failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command("pipeline:status")
  .description("Check pipeline status")
  .argument("<pipelineId>", "Pipeline ID")
  .option("-w, --watch", "Watch for status changes")
  .action(async (pipelineId, options) => {
    try {
      if (options.watch) {
        await watchPipelineStatus(pipelineId);
      } else {
        const status = await api.getPipelineStatus(pipelineId);
        displayPipelineStatus(status);
      }
    } catch (error) {
      logger.error(`Status check failed: ${error.message}`);
      process.exit(1);
    }
  });

// Image processing command
program
  .command("image")
  .description("Process images with variants and OCR")
  .argument("<chittyId>", "ChittyID for the image")
  .argument("<image>", "Image file path")
  .option(
    "--variants <types>",
    "Image variants (thumbnail,display,evidence)",
    "thumbnail,display",
  )
  .option("--ocr", "Extract text with OCR")
  .option("--redact <areas>", "Redaction areas (JSON array)")
  .action(async (chittyId, image, options) => {
    const progress = new ProgressTracker();

    try {
      if (!validateChittyID(chittyId)) {
        logger.error("Invalid ChittyID format");
        process.exit(1);
      }

      try {
        await fs.access(image);
      } catch {
        logger.error(`Image not found: ${image}`);
        process.exit(1);
      }

      progress.start("Processing image...");

      const processOptions = {
        variants: options.variants.split(","),
        ocr: options.ocr,
        redactionAreas: options.redact ? JSON.parse(options.redact) : null,
        requiresRedaction: !!options.redact,
      };

      const result = await api.processImage(chittyId, image, processOptions);

      progress.succeed("Image processing completed");

      const table = new Table({
        head: ["Property", "Value"],
        style: { head: ["cyan"] },
      });

      table.push(
        ["ChittyID", chittyId],
        ["Image ID", result.imageId],
        ["Delivery URL", result.deliveryUrl],
        ["Variants", Object.keys(result.variants).join(", ")],
        ["OCR Extracted", result.ocrText ? "Yes" : "No"],
      );

      console.log(table.toString());

      if (result.ocrText) {
        logger.info("Extracted Text:");
        console.log(result.ocrText);
      }
    } catch (error) {
      progress.fail(`Image processing failed: ${error.message}`);
      process.exit(1);
    }
  });

// Privacy protection command
program
  .command("protect")
  .description("Protect PII in documents")
  .argument("<chittyId>", "ChittyID for the data")
  .argument("<file>", "File to protect")
  .option("--mode <mode>", "Redaction mode (mask, tokenize, hash)", "mask")
  .option(
    "--types <types>",
    "PII types to detect",
    "ssn,credit_card,email,phone",
  )
  .option("--output <file>", "Output file path")
  .action(async (chittyId, file, options) => {
    const progress = new ProgressTracker();

    try {
      if (!validateChittyID(chittyId)) {
        logger.error("Invalid ChittyID format");
        process.exit(1);
      }

      const data = await fs.readFile(file, "utf8");

      progress.start("Detecting and protecting PII...");

      const protectionOptions = {
        redactionMode: options.mode,
        dataId: chittyId,
        detectionTypes: options.types.split(","),
      };

      const result = await api.protectPII(chittyId, data, protectionOptions);

      progress.succeed("PII protection completed");

      const table = new Table({
        head: ["Property", "Value"],
        style: { head: ["cyan"] },
      });

      table.push(
        ["ChittyID", chittyId],
        ["PII Detected", result.piiDetected],
        ["Audit ID", result.auditId],
        ["Compliance Status", result.complianceStatus],
        ["Redaction Mode", options.mode],
      );

      console.log(table.toString());

      // Save protected data
      const outputFile = options.output || `${file}.protected`;
      await fs.writeFile(outputFile, result.redactedData);
      logger.success(`Protected data saved to: ${outputFile}`);
    } catch (error) {
      progress.fail(`PII protection failed: ${error.message}`);
      process.exit(1);
    }
  });

// Monitoring commands
program
  .command("status")
  .description("Check system health and status")
  .option("-d, --detailed", "Show detailed status")
  .action(async (options) => {
    const progress = new ProgressTracker();

    try {
      progress.start("Checking system health...");

      const health = await api.getHealth();

      progress.succeed("Health check completed");

      // Overall status
      const statusColor =
        health.overall.status === "healthy"
          ? "green"
          : health.overall.status === "degraded"
            ? "yellow"
            : "red";

      console.log(
        `\nSystem Status: ${chalk[statusColor](health.overall.status.toUpperCase())}`,
      );
      console.log(
        `Operational Services: ${health.overall.operationalServices}/${health.overall.totalServices} (${health.overall.percentage.toFixed(1)}%)`,
      );

      // Services table
      if (options.detailed) {
        const servicesTable = new Table({
          head: ["Service", "Status", "Circuit Breaker"],
          style: { head: ["cyan"] },
        });

        Object.entries(health.services).forEach(([name, service]) => {
          const statusText =
            service.status === "healthy"
              ? chalk.green("Healthy")
              : chalk.red("Unhealthy");
          const cbText =
            service.circuitBreaker === "closed"
              ? chalk.green("Closed")
              : chalk.red(service.circuitBreaker);

          servicesTable.push([name, statusText, cbText]);
        });

        console.log("\nServices:");
        console.log(servicesTable.toString());

        // Storage status
        const storageTable = new Table({
          head: ["Storage", "Status"],
          style: { head: ["cyan"] },
        });

        Object.entries(health.storage).forEach(([name, storage]) => {
          const statusText = storage.healthy
            ? chalk.green("Healthy")
            : chalk.red("Unhealthy");
          storageTable.push([name.toUpperCase(), statusText]);
        });

        console.log("\nStorage:");
        console.log(storageTable.toString());
      }
    } catch (error) {
      progress.fail(`Health check failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command("metrics")
  .description("View system metrics")
  .option("-r, --range <range>", "Time range (1h, 24h, 7d)", "1h")
  .action(async (options) => {
    const progress = new ProgressTracker();

    try {
      progress.start("Fetching metrics...");

      const metrics = await api.getMetrics(options.range);

      progress.succeed("Metrics retrieved");

      const table = new Table({
        head: ["Metric", "Value"],
        style: { head: ["cyan"] },
      });

      table.push(
        ["Total Requests", metrics.summary.totalRequests.toLocaleString()],
        ["Total Errors", metrics.summary.totalErrors.toLocaleString()],
        ["Average Latency", `${metrics.summary.averageLatency}ms`],
        [
          "Error Rate",
          `${((metrics.summary.totalErrors / metrics.summary.totalRequests) * 100).toFixed(2)}%`,
        ],
      );

      console.log(`\nMetrics (${options.range}):`);
      console.log(table.toString());

      // Service metrics
      if (metrics.summary.services) {
        const serviceTable = new Table({
          head: ["Service", "Success", "Failure", "Success Rate"],
          style: { head: ["cyan"] },
        });

        Object.entries(metrics.summary.services).forEach(([name, service]) => {
          const total = service.success + service.failure;
          const successRate =
            total > 0 ? ((service.success / total) * 100).toFixed(1) : "0.0";

          serviceTable.push([
            name,
            service.success.toLocaleString(),
            service.failure.toLocaleString(),
            `${successRate}%`,
          ]);
        });

        console.log("\nService Metrics:");
        console.log(serviceTable.toString());
      }
    } catch (error) {
      progress.fail(`Metrics fetch failed: ${error.message}`);
      process.exit(1);
    }
  });

// Utility commands
program
  .command("generate-id")
  .description("Generate a new ChittyID")
  .option("-t, --type <type>", "Entity type (P, L, O, E, A)", "D")
  .action((options) => {
    const chittyId = generateChittyID(options.type);
    logger.success(`Generated ChittyID: ${chittyId}`);

    // Copy to clipboard if available
    try {
      const { execSync } = require("child_process");
      if (process.platform === "darwin") {
        execSync(`echo "${chittyId}" | pbcopy`);
        logger.info("ChittyID copied to clipboard");
      }
    } catch {
      // Ignore clipboard errors
    }
  });

program
  .command("validate-id")
  .description("Validate ChittyID format")
  .argument("<chittyId>", "ChittyID to validate")
  .action((chittyId) => {
    if (validateChittyID(chittyId)) {
      logger.success("ChittyID format is valid");

      // Parse components
      const parts = chittyId.split("-");
      const table = new Table({
        head: ["Component", "Value"],
        style: { head: ["cyan"] },
      });

      table.push(
        ["Version", parts[0]],
        ["Sequence", parts[1]],
        ["Country", parts[2]],
        ["Year", parts[3]],
        ["Type", parts[4]],
        ["Date", parts[5]],
        ["Sub-sequence", parts[6]],
        ["Check", parts[7]],
      );

      console.log(table.toString());
    } else {
      logger.error("Invalid ChittyID format");
      process.exit(1);
    }
  });

// Connector management
const connectors = new Map([
  [
    "replit",
    {
      name: "Replit",
      description: "Deploy and manage Replit projects",
      commands: ["list", "clone", "deploy", "sync"],
    },
  ],
  [
    "github",
    {
      name: "GitHub",
      description: "Manage GitHub repositories and actions",
      commands: ["repos", "actions", "workflows", "releases"],
    },
  ],
  [
    "vercel",
    {
      name: "Vercel",
      description: "Deploy to Vercel platform",
      commands: ["deploy", "domains", "env"],
    },
  ],
  [
    "cloudflare",
    {
      name: "Cloudflare",
      description: "Manage Cloudflare Workers and Pages",
      commands: ["workers", "pages", "kv", "r2"],
    },
  ],
  [
    "neon",
    {
      name: "Neon",
      description: "Serverless PostgreSQL database platform",
      commands: ["databases", "branches", "endpoints", "operations"],
    },
  ],
]);

// Connector commands
program
  .command("connect <provider>")
  .description("Connect to a service provider")
  .option("--token <token>", "API token")
  .option("--force", "Force reconnection")
  .action(async (provider, options) => {
    if (!connectors.has(provider)) {
      logger.error(`Unknown provider: ${provider}`);
      logger.info(
        `Available providers: ${Array.from(connectors.keys()).join(", ")}`,
      );
      process.exit(1);
    }

    const connector = connectors.get(provider);
    const spinner = ora(`Connecting to ${connector.name}...`).start();

    try {
      // Store connection config
      const configDir = path.join(os.homedir(), ".chittyos");
      const configFile = path.join(configDir, "connections.json");

      await fs.mkdir(configDir, { recursive: true });

      let config = {};
      try {
        config = JSON.parse(await fs.readFile(configFile, "utf8"));
      } catch {}

      config[provider] = {
        token: options.token || process.env[`${provider.toUpperCase()}_TOKEN`],
        connected: true,
        connectedAt: new Date().toISOString(),
      };

      await fs.writeFile(configFile, JSON.stringify(config, null, 2));

      spinner.succeed(`Connected to ${connector.name}`);
      logger.info(`Available commands: ${connector.commands.join(", ")}`);
    } catch (error) {
      spinner.fail(`Connection failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command("connectors")
  .description("List available connectors")
  .action(() => {
    const table = new Table({
      head: ["Provider", "Description", "Commands"],
      style: { head: ["cyan"] },
    });

    connectors.forEach((connector, key) => {
      table.push([key, connector.description, connector.commands.join(", ")]);
    });

    console.log(table.toString());
  });

// Helper functions
async function monitorPipeline(pipelineId, progress) {
  const maxAttempts = 60; // 5 minutes max
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const status = await api.getPipelineStatus(pipelineId);

      if (status.status === "completed") {
        progress.succeed("Pipeline completed successfully");
        return status;
      } else if (status.status === "failed") {
        progress.fail(`Pipeline failed: ${status.error}`);
        throw new Error(status.error);
      } else {
        progress.step(`Pipeline ${status.status}... (${status.progress}%)`);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    } catch (error) {
      progress.fail(`Pipeline monitoring failed: ${error.message}`);
      throw error;
    }
  }

  progress.fail("Pipeline monitoring timeout");
  throw new Error("Pipeline monitoring timeout");
}

async function watchPipelineStatus(pipelineId) {
  console.log(chalk.cyan(`Watching pipeline: ${pipelineId}`));
  console.log("Press Ctrl+C to stop watching\n");

  const interval = setInterval(async () => {
    try {
      const status = await api.getPipelineStatus(pipelineId);
      displayPipelineStatus(status);

      if (status.status === "completed" || status.status === "failed") {
        clearInterval(interval);
        process.exit(status.status === "completed" ? 0 : 1);
      }
    } catch (error) {
      logger.error(`Status check failed: ${error.message}`);
      clearInterval(interval);
      process.exit(1);
    }
  }, 5000);

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    clearInterval(interval);
    console.log("\nStopped watching pipeline");
    process.exit(0);
  });
}

function displayPipelineStatus(status) {
  const table = new Table({
    head: ["Property", "Value"],
    style: { head: ["cyan"] },
  });

  table.push(
    ["Pipeline ID", status.pipelineId],
    ["Status", status.status],
    ["Progress", `${status.progress || 0}%`],
    ["Started", new Date(status.startTime).toLocaleString()],
    ["Duration", status.duration ? `${status.duration}ms` : "Running..."],
  );

  if (status.stages) {
    status.stages.forEach((stage, index) => {
      table.push([`Stage ${index + 1}`, `${stage.name}: ${stage.status}`]);
    });
  }

  console.log(table.toString());
}

// Error handling
process.on("unhandledRejection", (error) => {
  logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});

// Check for API key (unless in help mode)
const isHelpMode =
  process.argv.includes("--help") ||
  process.argv.includes("-h") ||
  process.argv.includes("--yes");
if (!API_KEY && !isHelpMode) {
  logger.error("CHITTY_API_KEY environment variable is required");
  logger.info("Set your API key: export CHITTY_API_KEY=your_api_key");
  process.exit(1);
}

// Parse CLI arguments
program.parse();

export { ChittyAPI, validateChittyID, generateChittyID };
