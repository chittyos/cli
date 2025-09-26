/**
 * ChittyID Secure Fallback Client
 *
 * ARCHITECTURE: Server-Controlled Fallback System
 * - NO local generation capability
 * - Pre-authorized fallback IDs from redundant service
 * - Cryptographically sound error-coded IDs
 * - Automatic reconciliation when main server returns
 */

import https from "https";
import http from "http";

export class ChittyIDFallbackClient {
  constructor(config = {}) {
    // Main server configuration
    this.mainServerUrl =
      config.mainServerUrl ||
      process.env.CHITTY_SERVER_URL ||
      "https://id.chitty.cc";

    // Redundant fallback service (highly available, separate infrastructure)
    this.fallbackServiceUrl =
      config.fallbackServiceUrl ||
      process.env.CHITTY_FALLBACK_URL ||
      "https://fallback.id.chitty.cc";

    this.apiKey = config.apiKey || process.env.CHITTY_API_KEY;
    this.timeout = config.timeout || 5000;

    // Track fallback IDs that need reconciliation
    this.pendingReconciliation = new Set();

    // Parse URLs for both services
    this.mainServer = this.parseUrl(this.mainServerUrl);
    this.fallbackService = this.parseUrl(this.fallbackServiceUrl);
  }

  parseUrl(urlString) {
    const url = new URL(urlString);
    return {
      protocol: url.protocol === "https:" ? https : http,
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      basePath: url.pathname.replace(/\/$/, ""),
    };
  }

  /**
   * Request ChittyID with automatic fallback to pre-authorized service
   * @param {Object} options - Request options
   * @returns {Promise<Object>} ChittyID response (normal or fallback)
   */
  async requestChittyID(options = {}) {
    try {
      // Step 1: Try main server
      const mainResponse = await this.requestFromServer(
        this.mainServer,
        options,
      );

      // If we have pending reconciliations and main server is up, trigger reconciliation
      if (this.pendingReconciliation.size > 0) {
        this.triggerReconciliation();
      }

      return mainResponse;
    } catch (mainError) {
      console.warn("Main server unavailable:", mainError.message);

      try {
        // Step 2: Request pre-authorized fallback ID from redundant service
        const fallbackResponse = await this.requestFallbackID(options);

        // Mark for reconciliation
        this.pendingReconciliation.add(fallbackResponse.identifier);

        return fallbackResponse;
      } catch (fallbackError) {
        // Both services unavailable - complete failure (as designed)
        throw new Error(
          `ChittyID services unavailable - Main: ${mainError.message}, Fallback: ${fallbackError.message}`,
        );
      }
    }
  }

  /**
   * Request from a specific server
   * @private
   */
  async requestFromServer(server, options) {
    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify({
        namespace: options.namespace || "GEN",
        type: options.type || "I",
        parent: options.parent,
        metadata: options.metadata || {},
        requestId: this.generateRequestId(),
      });

      const requestOptions = {
        hostname: server.hostname,
        port: server.port,
        path: `${server.basePath}/api/chittyid/generate`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestData),
          "X-API-Key": this.apiKey,
        },
        timeout: this.timeout,
      };

      const req = server.protocol.request(requestOptions, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(new Error(`Invalid response: ${err.message}`));
            }
          } else {
            reject(new Error(`Server error: ${res.statusCode}`));
          }
        });
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.on("error", (err) => {
        reject(new Error(`Connection failed: ${err.message}`));
      });

      req.write(requestData);
      req.end();
    });
  }

  /**
   * Request pre-authorized fallback ID from redundant service
   * @private
   */
  async requestFallbackID(options) {
    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify({
        namespace: options.namespace || "GEN",
        type: options.type || "I",
        parent: options.parent,
        metadata: {
          ...options.metadata,
          fallback: true,
          timestamp: new Date().toISOString(),
        },
      });

      const requestOptions = {
        hostname: this.fallbackService.hostname,
        port: this.fallbackService.port,
        path: `${this.fallbackService.basePath}/api/chittyid/fallback`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestData),
          "X-API-Key": this.apiKey,
          "X-Fallback-Request": "true",
        },
        timeout: this.timeout,
      };

      const req = this.fallbackService.protocol.request(
        requestOptions,
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const response = JSON.parse(data);
                // Fallback IDs have domain 'E' for error/offline state
                response.isFallback = true;
                response.requiresReconciliation = true;
                resolve(response);
              } catch (err) {
                reject(new Error(`Invalid fallback response: ${err.message}`));
              }
            } else {
              reject(new Error(`Fallback service error: ${res.statusCode}`));
            }
          });
        },
      );

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Fallback request timeout"));
      });

      req.on("error", (err) => {
        reject(new Error(`Fallback connection failed: ${err.message}`));
      });

      req.write(requestData);
      req.end();
    });
  }

  /**
   * Reconcile a fallback ID with permanent ID from main server
   * @param {string} fallbackId - The fallback ChittyID to reconcile
   * @returns {Promise<Object>} Permanent ChittyID replacement
   */
  async reconcileChittyID(fallbackId) {
    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify({
        fallbackId: fallbackId,
        action: "reconcile",
        timestamp: new Date().toISOString(),
      });

      const requestOptions = {
        hostname: this.mainServer.hostname,
        port: this.mainServer.port,
        path: `${this.mainServer.basePath}/api/chittyid/reconcile`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestData),
          "X-API-Key": this.apiKey,
        },
        timeout: this.timeout * 2, // Double timeout for reconciliation
      };

      const req = this.mainServer.protocol.request(requestOptions, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const response = JSON.parse(data);
              // Remove from pending list
              this.pendingReconciliation.delete(fallbackId);
              resolve(response);
            } catch (err) {
              reject(
                new Error(`Invalid reconciliation response: ${err.message}`),
              );
            }
          } else {
            reject(new Error(`Reconciliation failed: ${res.statusCode}`));
          }
        });
      });

      req.on("error", (err) => {
        reject(new Error(`Reconciliation connection failed: ${err.message}`));
      });

      req.write(requestData);
      req.end();
    });
  }

  /**
   * Trigger reconciliation for all pending fallback IDs
   * @private
   */
  async triggerReconciliation() {
    const pendingIds = Array.from(this.pendingReconciliation);

    if (pendingIds.length === 0) return;

    console.log(`Reconciling ${pendingIds.length} fallback ChittyIDs...`);

    const reconciliationPromises = pendingIds.map(async (fallbackId) => {
      try {
        const permanent = await this.reconcileChittyID(fallbackId);
        console.log(`Reconciled: ${fallbackId} -> ${permanent.identifier}`);
        return { fallbackId, permanentId: permanent.identifier, success: true };
      } catch (error) {
        console.error(`Failed to reconcile ${fallbackId}:`, error.message);
        return { fallbackId, error: error.message, success: false };
      }
    });

    const results = await Promise.allSettled(reconciliationPromises);
    return results;
  }

  /**
   * Get list of IDs pending reconciliation
   */
  getPendingReconciliations() {
    return Array.from(this.pendingReconciliation);
  }

  /**
   * Generate request ID for tracking
   * @private
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * NO LOCAL GENERATION - This is NEVER allowed
   * @throws {Error} Always throws - local generation is forbidden
   */
  generateLocal() {
    throw new Error(
      "LOCAL GENERATION FORBIDDEN: ChittyIDs must come from server or fallback service",
    );
  }
}

// Export convenience functions
export async function requestChittyIDWithFallback(options) {
  const client = new ChittyIDFallbackClient();
  return client.requestChittyID(options);
}

export async function reconcileChittyID(fallbackId) {
  const client = new ChittyIDFallbackClient();
  return client.reconcileChittyID(fallbackId);
}

export default ChittyIDFallbackClient;
