/**
 * ChittyID Client - STRICT SERVER-ONLY REQUEST
 *
 * HARD RULE: ChittyIDs are NEVER generated locally
 * - No fallback generation
 * - No local backups
 * - No offline mode
 * - ONLY request from central server
 */

import https from "https";
import http from "http";

export class ChittyIDClient {
  constructor(config = {}) {
    // Central server configuration
    this.serverUrl =
      config.serverUrl ||
      process.env.CHITTY_SERVER_URL ||
      "https://id.chitty.cc";
    this.apiKey = config.apiKey || process.env.CHITTY_API_KEY;
    this.timeout = config.timeout || 5000;

    // Parse server URL
    const url = new URL(this.serverUrl);
    this.protocol = url.protocol === "https:" ? https : http;
    this.hostname = url.hostname;
    this.port = url.port || (url.protocol === "https:" ? 443 : 80);
    this.basePath = url.pathname.replace(/\/$/, "");

    // NO local storage, NO caching, NO fallbacks
    // Every ID must come from the server
  }

  /**
   * Request a ChittyID from the central server
   * @param {Object} options - Request options
   * @param {string} options.namespace - Namespace for the ID
   * @param {string} options.type - Type of ID (I, L, A, V)
   * @param {string} options.parent - Parent ChittyID for appendages
   * @returns {Promise<Object>} ChittyID response from server
   * @throws {Error} If server is unavailable or request fails
   */
  async requestChittyID(options = {}) {
    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify({
        namespace: options.namespace || "GEN",
        type: options.type || "I",
        parent: options.parent,
        metadata: options.metadata || {},
      });

      const requestOptions = {
        hostname: this.hostname,
        port: this.port,
        path: `${this.basePath}/api/chittyid/generate`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestData),
          "X-API-Key": this.apiKey,
          "X-Request-ID": this.generateRequestId(),
        },
        timeout: this.timeout,
      };

      const req = this.protocol.request(requestOptions, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const response = JSON.parse(data);
              resolve(response);
            } catch (err) {
              reject(new Error(`Invalid server response: ${err.message}`));
            }
          } else {
            reject(new Error(`Server error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on("timeout", () => {
        req.destroy();
        reject(
          new Error("ChittyID server request timeout - NO FALLBACK ALLOWED"),
        );
      });

      req.on("error", (err) => {
        reject(
          new Error(
            `ChittyID server unavailable: ${err.message} - NO LOCAL GENERATION ALLOWED`,
          ),
        );
      });

      req.write(requestData);
      req.end();
    });
  }

  /**
   * Verify a ChittyID with the central server
   * @param {string} chittyId - The ChittyID to verify
   * @returns {Promise<Object>} Verification response from server
   * @throws {Error} If server is unavailable or verification fails
   */
  async verifyChittyID(chittyId) {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: this.hostname,
        port: this.port,
        path: `${this.basePath}/api/chittyid/verify/${encodeURIComponent(chittyId)}`,
        method: "GET",
        headers: {
          "X-API-Key": this.apiKey,
          "X-Request-ID": this.generateRequestId(),
        },
        timeout: this.timeout,
      };

      const req = this.protocol.request(requestOptions, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const response = JSON.parse(data);
              resolve(response);
            } catch (err) {
              reject(
                new Error(`Invalid verification response: ${err.message}`),
              );
            }
          } else {
            reject(
              new Error(`Verification failed: ${res.statusCode} - ${data}`),
            );
          }
        });
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("ChittyID verification timeout"));
      });

      req.on("error", (err) => {
        reject(new Error(`ChittyID verification failed: ${err.message}`));
      });

      req.end();
    });
  }

  /**
   * Batch request multiple ChittyIDs
   * @param {Array} requests - Array of request options
   * @returns {Promise<Array>} Array of ChittyID responses
   * @throws {Error} If server is unavailable
   */
  async requestBatch(requests) {
    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify({
        batch: requests,
        timestamp: new Date().toISOString(),
      });

      const requestOptions = {
        hostname: this.hostname,
        port: this.port,
        path: `${this.basePath}/api/chittyid/batch`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestData),
          "X-API-Key": this.apiKey,
          "X-Request-ID": this.generateRequestId(),
        },
        timeout: this.timeout * 2, // Double timeout for batch
      };

      const req = this.protocol.request(requestOptions, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const response = JSON.parse(data);
              resolve(response.ids || []);
            } catch (err) {
              reject(new Error(`Invalid batch response: ${err.message}`));
            }
          } else {
            reject(
              new Error(`Batch request failed: ${res.statusCode} - ${data}`),
            );
          }
        });
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("ChittyID batch request timeout - NO FALLBACK"));
      });

      req.on("error", (err) => {
        reject(
          new Error(`ChittyID server unavailable for batch: ${err.message}`),
        );
      });

      req.write(requestData);
      req.end();
    });
  }

  /**
   * Generate request ID for tracking
   * @private
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * NO LOCAL GENERATION - This method throws an error
   * @deprecated Local generation is STRICTLY FORBIDDEN
   */
  generateLocal() {
    throw new Error(
      "LOCAL CHITTYID GENERATION IS STRICTLY FORBIDDEN - Must request from server",
    );
  }

  /**
   * NO FALLBACK MODE - This method throws an error
   * @deprecated Fallback mode is NOT ALLOWED
   */
  enableFallback() {
    throw new Error(
      "CHITTYID FALLBACK MODE IS NOT ALLOWED - Server request only",
    );
  }

  /**
   * NO CACHING - This method throws an error
   * @deprecated Caching ChittyIDs is NOT PERMITTED
   */
  cacheID() {
    throw new Error(
      "CHITTYID CACHING IS NOT PERMITTED - Fresh request required",
    );
  }
}

// Singleton instance for global use
let clientInstance = null;

/**
 * Get or create the ChittyID client instance
 * @param {Object} config - Configuration options
 * @returns {ChittyIDClient} The client instance
 */
export function getChittyIDClient(config) {
  if (!clientInstance) {
    clientInstance = new ChittyIDClient(config);
  }
  return clientInstance;
}

/**
 * Request a ChittyID (convenience function)
 * STRICT RULE: Only requests from server, no local generation
 */
export async function requestChittyID(options) {
  const client = getChittyIDClient();
  return client.requestChittyID(options);
}

/**
 * Verify a ChittyID (convenience function)
 */
export async function verifyChittyID(chittyId) {
  const client = getChittyIDClient();
  return client.verifyChittyID(chittyId);
}

// Export default
export default {
  ChittyIDClient,
  getChittyIDClient,
  requestChittyID,
  verifyChittyID,
};
