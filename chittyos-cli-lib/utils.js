/**
 * Utility Functions Module
 * Common utilities and helpers
 */

import chalk from "chalk";
import ora from "ora";
import crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Logger utility with enhanced formatting
export const logger = {
  info: (msg) => console.log(chalk.blue("ℹ"), msg),
  success: (msg) => console.log(chalk.green("✅"), msg),
  warn: (msg) => console.log(chalk.yellow("⚠"), msg),
  error: (msg) => console.log(chalk.red("❌"), msg),
  debug: (msg) => process.env.DEBUG && console.log(chalk.gray("🐛"), msg),
  synthesis: (msg) => console.log(chalk.magenta("🧬"), msg),
  connector: (msg) => console.log(chalk.cyan("🔌"), msg),
};

// ChittyID validation and generation
export function validateChittyID(chittyId) {
  const pattern =
    /^[0-9]{2}-[0-9]{1}-[A-Z]{3}-[0-9]{4}-[A-Z]{1}-[0-9]{6}-[0-9]{1}-[0-9]{1,2}$/;
  return pattern.test(chittyId);
}

export function generateChittyID(entityType = "D") {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const sequence = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");

  return `01-1-USA-${year}-${entityType}-${year}${month}-1-${sequence.slice(-2)}`;
}

// Progress tracking with synthesis support
export class ProgressTracker {
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

  synthesis(message) {
    if (this.spinner) {
      this.spinner.text = chalk.magenta(message);
    } else {
      logger.synthesis(message);
    }
  }
}

// Enhanced synthesis engine integration
export class SynthesisEngine {
  constructor(config = {}) {
    this.providers = new Map();
    this.activeConnections = new Map();
    this.config = config;
  }

  async synthesize(data, options = {}) {
    const synthesisId = crypto.randomBytes(16).toString("hex");

    logger.synthesis(`Initiating synthesis: ${synthesisId}`);

    // Multi-provider synthesis
    const results = await Promise.allSettled(
      Array.from(this.providers.values()).map((provider) =>
        provider.process(data, options),
      ),
    );

    // Aggregate results
    const successfulResults = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    return {
      synthesisId,
      results: successfulResults,
      metadata: {
        providers: this.providers.size,
        successful: successfulResults.length,
        timestamp: new Date().toISOString(),
      },
    };
  }

  registerProvider(name, provider) {
    this.providers.set(name, provider);
    logger.synthesis(`Provider registered: ${name}`);
  }

  async connectProvider(name, config) {
    const connection = {
      name,
      config,
      status: "connected",
      connectedAt: new Date().toISOString(),
    };

    this.activeConnections.set(name, connection);
    logger.connector(`Connected to ${name}`);

    return connection;
  }
}

// Configuration management
export class ConfigManager {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = {};
  }

  async load() {
    try {
      const fs = await import("fs/promises");
      const data = await fs.readFile(this.configPath, "utf8");
      this.config = JSON.parse(data);
      return this.config;
    } catch (error) {
      logger.debug(`Config load failed: ${error.message}`);
      return this.config;
    }
  }

  async save() {
    const fs = await import("fs/promises");
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  get(key, defaultValue = null) {
    return this.config[key] ?? defaultValue;
  }

  set(key, value) {
    this.config[key] = value;
  }
}

// Service status definitions
export const SERVICE_STATUS = {
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  UNHEALTHY: "unhealthy",
  UNKNOWN: "unknown",
};

// Pipeline status definitions
export const PIPELINE_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

// Error classes
export class ChittyError extends Error {
  constructor(message, code = "CHITTY_ERROR") {
    super(message);
    this.name = "ChittyError";
    this.code = code;
  }
}

export class ValidationError extends ChittyError {
  constructor(message) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class APIError extends ChittyError {
  constructor(message, statusCode) {
    super(message, "API_ERROR");
    this.name = "APIError";
    this.statusCode = statusCode;
  }
}

// System utilities
export async function getSystemInfo() {
  try {
    const { stdout: platform } = await execAsync("uname -s");
    const { stdout: arch } = await execAsync("uname -m");
    const { stdout: nodeVersion } = await execAsync("node --version");

    return {
      platform: platform.trim(),
      arch: arch.trim(),
      nodeVersion: nodeVersion.trim(),
      processId: process.pid,
      uptime: process.uptime(),
    };
  } catch (error) {
    logger.debug(`Failed to get system info: ${error.message}`);
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      processId: process.pid,
      uptime: process.uptime(),
    };
  }
}

// Clipboard integration
export async function copyToClipboard(text) {
  try {
    if (process.platform === "darwin") {
      await execAsync(`echo "${text}" | pbcopy`);
      return true;
    } else if (process.platform === "linux") {
      await execAsync(`echo "${text}" | xclip -selection clipboard`);
      return true;
    }
  } catch (error) {
    logger.debug(`Clipboard copy failed: ${error.message}`);
  }
  return false;
}
