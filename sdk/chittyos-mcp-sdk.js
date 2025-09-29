/**
 * ChittyOS MCP SDK - Developer Integration Library
 * Provides easy integration with ChittyOS MCP Extension
 *
 * @version 1.0.1
 * @license MIT
 */

const { EventEmitter } = require("events");

/**
 * Main SDK class for ChittyOS MCP Extension integration
 */
class ChittyOSSDK extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      apiKey: options.apiKey || process.env.CHITTY_API_KEY,
      baseUrl: options.baseUrl || "https://api.chitty.cc",
      version: options.version || "v1",
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      debug: options.debug || false,
    };

    this.tools = new ToolsAPI(this);
    this.cases = new CasesAPI(this);
    this.documents = new DocumentsAPI(this);
    this.payments = new PaymentsAPI(this);
    this.compliance = new ComplianceAPI(this);
    this.workflows = new WorkflowsAPI(this);

    this._initializeClient();
  }

  /**
   * Initialize the HTTP client
   */
  _initializeClient() {
    this.client = {
      request: async (method, endpoint, data = null) => {
        const url = `${this.config.baseUrl}/${this.config.version}${endpoint}`;
        const options = {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
            "User-Agent": "ChittyOS-SDK/1.0.1",
          },
        };

        if (data) {
          options.body = JSON.stringify(data);
        }

        if (this.config.debug) {
          console.log(`[SDK] ${method} ${url}`, data);
        }

        try {
          const response = await this._fetchWithRetry(url, options);
          const result = await response.json();

          if (!response.ok) {
            throw new Error(
              `API Error: ${result.message || response.statusText}`,
            );
          }

          return result;
        } catch (error) {
          this.emit("error", error);
          throw error;
        }
      },
    };
  }

  /**
   * HTTP fetch with retry logic
   */
  async _fetchWithRetry(url, options, attempt = 1) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(this.config.timeout),
      });
      return response;
    } catch (error) {
      if (
        attempt < this.config.retries &&
        (error.name === "TimeoutError" ||
          error.code === "ECONNRESET" ||
          error.code === "ENOTFOUND")
      ) {
        console.warn(
          `[SDK] Retry ${attempt}/${this.config.retries} for ${url}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        return this._fetchWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Test the connection to ChittyOS services
   */
  async ping() {
    try {
      const result = await this.client.request("GET", "/ping");
      this.emit("connected", result);
      return result;
    } catch (error) {
      this.emit("disconnected", error);
      throw error;
    }
  }

  /**
   * Get current user/organization info
   */
  async getInfo() {
    return this.client.request("GET", "/info");
  }
}

/**
 * Tools API - ChittyID generation and tool management
 */
class ToolsAPI {
  constructor(sdk) {
    this.sdk = sdk;
  }

  /**
   * Generate a new ChittyID
   */
  async generateId(prefix = "CHITTY") {
    return this.sdk.client.request("POST", "/tools/generate-id", { prefix });
  }

  /**
   * Validate a ChittyID
   */
  async validateId(chittyId) {
    return this.sdk.client.request("POST", "/tools/validate-id", {
      chitty_id: chittyId,
    });
  }

  /**
   * Get tool usage statistics
   */
  async getUsageStats(timeframe = "30d") {
    return this.sdk.client.request(
      "GET",
      `/tools/stats?timeframe=${timeframe}`,
    );
  }

  /**
   * List available tools
   */
  async listTools() {
    return this.sdk.client.request("GET", "/tools");
  }
}

/**
 * Cases API - Legal case management
 */
class CasesAPI {
  constructor(sdk) {
    this.sdk = sdk;
  }

  /**
   * Create a new legal case
   */
  async create(caseData) {
    const requiredFields = ["title", "client"];
    const missing = requiredFields.filter((field) => !caseData[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(", ")}`);
    }

    return this.sdk.client.request("POST", "/cases", caseData);
  }

  /**
   * Get case by ID
   */
  async get(caseId) {
    return this.sdk.client.request("GET", `/cases/${caseId}`);
  }

  /**
   * Update case
   */
  async update(caseId, updates) {
    return this.sdk.client.request("PUT", `/cases/${caseId}`, updates);
  }

  /**
   * Search cases
   */
  async search(query, filters = {}) {
    const params = new URLSearchParams({ query, ...filters });
    return this.sdk.client.request("GET", `/cases/search?${params}`);
  }

  /**
   * List cases with pagination
   */
  async list(options = {}) {
    const { page = 1, limit = 20, status, client } = options;
    const params = new URLSearchParams({ page, limit });

    if (status) params.append("status", status);
    if (client) params.append("client", client);

    return this.sdk.client.request("GET", `/cases?${params}`);
  }

  /**
   * Delete case
   */
  async delete(caseId) {
    return this.sdk.client.request("DELETE", `/cases/${caseId}`);
  }
}

/**
 * Documents API - Document analysis and management
 */
class DocumentsAPI {
  constructor(sdk) {
    this.sdk = sdk;
  }

  /**
   * Analyze a document
   */
  async analyze(documentPath, analysisType = "all") {
    return this.sdk.client.request("POST", "/documents/analyze", {
      document_path: documentPath,
      analysis_type: analysisType,
    });
  }

  /**
   * Upload a document
   */
  async upload(file, metadata = {}) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("metadata", JSON.stringify(metadata));

    const options = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.sdk.config.apiKey}`,
      },
      body: formData,
    };

    const url = `${this.sdk.config.baseUrl}/${this.sdk.config.version}/documents/upload`;
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get document by ID
   */
  async get(documentId) {
    return this.sdk.client.request("GET", `/documents/${documentId}`);
  }

  /**
   * List documents
   */
  async list(options = {}) {
    const { page = 1, limit = 20, type, case_id } = options;
    const params = new URLSearchParams({ page, limit });

    if (type) params.append("type", type);
    if (case_id) params.append("case_id", case_id);

    return this.sdk.client.request("GET", `/documents?${params}`);
  }

  /**
   * Delete document
   */
  async delete(documentId) {
    return this.sdk.client.request("DELETE", `/documents/${documentId}`);
  }
}

/**
 * Payments API - Financial transaction management
 */
class PaymentsAPI {
  constructor(sdk) {
    this.sdk = sdk;
  }

  /**
   * Process a payment
   */
  async process(paymentData) {
    const requiredFields = ["amount", "client_id"];
    const missing = requiredFields.filter((field) => !paymentData[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(", ")}`);
    }

    return this.sdk.client.request("POST", "/payments", paymentData);
  }

  /**
   * Get payment by ID
   */
  async get(paymentId) {
    return this.sdk.client.request("GET", `/payments/${paymentId}`);
  }

  /**
   * List payments
   */
  async list(options = {}) {
    const { page = 1, limit = 20, status, client_id } = options;
    const params = new URLSearchParams({ page, limit });

    if (status) params.append("status", status);
    if (client_id) params.append("client_id", client_id);

    return this.sdk.client.request("GET", `/payments?${params}`);
  }

  /**
   * Refund a payment
   */
  async refund(paymentId, amount = null, reason = "") {
    return this.sdk.client.request("POST", `/payments/${paymentId}/refund`, {
      amount,
      reason,
    });
  }
}

/**
 * Compliance API - §36 compliance validation
 */
class ComplianceAPI {
  constructor(sdk) {
    this.sdk = sdk;
  }

  /**
   * Run compliance check
   */
  async check(path, checkType = "all") {
    return this.sdk.client.request("POST", "/compliance/check", {
      path,
      check_type: checkType,
    });
  }

  /**
   * Get compliance report
   */
  async getReport(reportId) {
    return this.sdk.client.request("GET", `/compliance/reports/${reportId}`);
  }

  /**
   * List compliance reports
   */
  async listReports(options = {}) {
    const { page = 1, limit = 20, status } = options;
    const params = new URLSearchParams({ page, limit });

    if (status) params.append("status", status);

    return this.sdk.client.request("GET", `/compliance/reports?${params}`);
  }

  /**
   * Get compliance metrics
   */
  async getMetrics(timeframe = "30d") {
    return this.sdk.client.request(
      "GET",
      `/compliance/metrics?timeframe=${timeframe}`,
    );
  }
}

/**
 * Workflows API - Legal workflow automation
 */
class WorkflowsAPI {
  constructor(sdk) {
    this.sdk = sdk;
  }

  /**
   * Execute a workflow
   */
  async execute(workflow, context = {}) {
    const validWorkflows = ["intake", "discovery", "filing", "billing"];

    if (!validWorkflows.includes(workflow)) {
      throw new Error(
        `Invalid workflow: ${workflow}. Must be one of: ${validWorkflows.join(", ")}`,
      );
    }

    return this.sdk.client.request("POST", "/workflows/execute", {
      workflow,
      context,
    });
  }

  /**
   * Get workflow status
   */
  async getStatus(workflowId) {
    return this.sdk.client.request("GET", `/workflows/${workflowId}/status`);
  }

  /**
   * List workflow executions
   */
  async list(options = {}) {
    const { page = 1, limit = 20, status, workflow } = options;
    const params = new URLSearchParams({ page, limit });

    if (status) params.append("status", status);
    if (workflow) params.append("workflow", workflow);

    return this.sdk.client.request("GET", `/workflows?${params}`);
  }

  /**
   * Cancel a workflow execution
   */
  async cancel(workflowId, reason = "") {
    return this.sdk.client.request("POST", `/workflows/${workflowId}/cancel`, {
      reason,
    });
  }

  /**
   * Get available workflow templates
   */
  async getTemplates() {
    return this.sdk.client.request("GET", "/workflows/templates");
  }
}

/**
 * Utility functions
 */
class ChittyOSUtils {
  /**
   * Validate ChittyID format
   */
  static validateChittyIdFormat(chittyId) {
    const pattern = /^[A-Z]+-\d{8,}-[A-Z0-9]+$/;
    return pattern.test(chittyId);
  }

  /**
   * Parse ChittyID components
   */
  static parseChittyId(chittyId) {
    const parts = chittyId.split("-");
    if (parts.length < 3) {
      throw new Error("Invalid ChittyID format");
    }

    return {
      prefix: parts[0],
      timestamp: parts[1],
      suffix: parts.slice(2).join("-"),
      original: chittyId,
    };
  }

  /**
   * Format currency amount
   */
  static formatCurrency(amount, currency = "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  }

  /**
   * Validate email format
   */
  static validateEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
  }

  /**
   * Generate secure random string
   */
  static generateSecureId(length = 16) {
    const crypto = require("crypto");
    return crypto.randomBytes(length).toString("hex");
  }
}

/**
 * Error classes
 */
class ChittyOSError extends Error {
  constructor(message, code = null, details = null) {
    super(message);
    this.name = "ChittyOSError";
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends ChittyOSError {
  constructor(message, field = null) {
    super(message, "VALIDATION_ERROR", { field });
    this.name = "ValidationError";
  }
}

class APIError extends ChittyOSError {
  constructor(message, statusCode = null, response = null) {
    super(message, "API_ERROR", { statusCode, response });
    this.name = "APIError";
  }
}

// Export everything
module.exports = {
  ChittyOSSDK,
  ChittyOSUtils,
  ChittyOSError,
  ValidationError,
  APIError,
};

// Browser compatibility
if (typeof window !== "undefined") {
  window.ChittyOS = module.exports;
}
