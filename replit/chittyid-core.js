#!/usr/bin/env node

/**
 * ChittyID Core - STRICT SERVER-ONLY CLIENT
 *
 * CRITICAL CHANGE: This file has been updated to enforce server-only generation
 * NO LOCAL GENERATION IS PERMITTED UNDER ANY CIRCUMSTANCES
 *
 * All ChittyIDs MUST be requested from: https://id.chitty.cc
 *
 * Previous versions of this file contained local generation code which violated
 * ChittyOS security policies. This has been completely removed.
 */

import https from "https";
import http from "http";

export class ChittyIDCore {
  constructor(config = {}) {
    // Server configuration - ONLY server requests allowed
    this.serverUrl =
      config.serverUrl ||
      process.env.CHITTY_SERVER_URL ||
      "https://id.chitty.cc";
    this.apiKey = config.apiKey || process.env.CHITTY_API_KEY;

    if (!this.apiKey) {
      console.warn(
        "WARNING: CHITTY_API_KEY not configured. " +
          "ChittyID requests will fail. " +
          "NO LOCAL GENERATION IS AVAILABLE.",
      );
    }

    // Parse server URL
    const url = new URL(this.serverUrl);
    this.protocol = url.protocol === "https:" ? https : http;
    this.hostname = url.hostname;
    this.port = url.port || (url.protocol === "https:" ? 443 : 80);
    this.basePath = url.pathname.replace(/\/$/, "");
  }

  /**
   * Request ChittyID from server - NO LOCAL GENERATION
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Server response with ChittyID
   * @throws {Error} Always throws if server unavailable - no fallback
   */
  async generateChittyID(options = {}) {
    if (!this.apiKey) {
      throw new Error(
        "CHITTYID_ERROR: API key required. " +
          "Configure CHITTY_API_KEY environment variable. " +
          "NO LOCAL GENERATION AVAILABLE.",
      );
    }

    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify({
        namespace: options.namespace || "GEN",
        domain: options.domain || "C",
        type: options.type || "I",
        metadata: options.metadata || {},
        timestamp: Date.now(),
      });

      const requestOptions = {
        hostname: this.hostname,
        port: this.port,
        path: `${this.basePath}/api/chittyid/generate`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestData),
          Authorization: `Bearer ${this.apiKey}`,
          "User-Agent": "ChittyIDCore-ServerOnly/2.0",
        },
      };

      const req = this.protocol.request(requestOptions, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const response = JSON.parse(data);

            if (res.statusCode === 200) {
              resolve({
                identifier: response.chittyId,
                metadata: response.metadata,
                generatedAt: response.generatedAt,
                server: this.serverUrl,
                pipeline: response.pipeline,
              });
            } else {
              reject(
                new Error(
                  `Server error ${res.statusCode}: ${response.error || "Unknown error"}. ` +
                    "NO LOCAL GENERATION AVAILABLE.",
                ),
              );
            }
          } catch (parseError) {
            reject(
              new Error(
                `Invalid server response: ${parseError.message}. ` +
                  "NO LOCAL GENERATION AVAILABLE.",
              ),
            );
          }
        });
      });

      req.on("error", (error) => {
        reject(
          new Error(
            `Server connection failed: ${error.message}. ` +
              "NO LOCAL GENERATION AVAILABLE. " +
              "Ensure server connectivity to " +
              this.serverUrl,
          ),
        );
      });

      req.setTimeout(5000, () => {
        req.destroy();
        reject(
          new Error(
            "Server request timeout. " +
              "NO LOCAL GENERATION AVAILABLE. " +
              "Check network connectivity to " +
              this.serverUrl,
          ),
        );
      });

      req.write(requestData);
      req.end();
    });
  }

  /**
   * Verify ChittyID with server
   * @param {string} chittyId - The ChittyID to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifyChittyID(chittyId) {
    if (!this.apiKey) {
      throw new Error("CHITTYID_ERROR: API key required for verification");
    }

    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: this.hostname,
        port: this.port,
        path: `${this.basePath}/api/chittyid/verify/${encodeURIComponent(chittyId)}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "User-Agent": "ChittyIDCore-ServerOnly/2.0",
        },
      };

      const req = this.protocol.request(requestOptions, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const response = JSON.parse(data);

            if (res.statusCode === 200) {
              resolve({
                valid: response.valid,
                chittyId: response.chittyId,
                metadata: response.metadata,
                verifiedAt: response.verifiedAt,
              });
            } else {
              resolve({
                valid: false,
                error: response.error || "Verification failed",
              });
            }
          } catch (parseError) {
            reject(
              new Error(`Invalid verification response: ${parseError.message}`),
            );
          }
        });
      });

      req.on("error", (error) => {
        reject(new Error(`Verification request failed: ${error.message}`));
      });

      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("Verification request timeout"));
      });

      req.end();
    });
  }

  /**
   * REMOVED METHODS - NO LOCAL OPERATIONS
   * The following methods have been removed as they violated security policy:
   * - generateSequence() - Local sequence generation
   * - generateComponent() - Local component generation
   * - calculateChecksum() - Local checksum calculation
   * - getDrandRandomness() - Direct drand access
   * - generateSequenceSync() - Synchronous local generation
   * - generateComponentSync() - Synchronous component generation
   *
   * ALL ChittyID operations MUST go through the server at id.chitty.cc
   */

  /**
   * Legacy method - throws error directing to server
   */
  generateLocalChittyID() {
    throw new Error(
      "LOCAL GENERATION REMOVED: This method has been removed for security. " +
        "All ChittyIDs must be requested from the server at " +
        this.serverUrl +
        ". " +
        "Use generateChittyID() which now makes server requests only.",
    );
  }

  /**
   * Get server status
   */
  async getServerStatus() {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: this.hostname,
        port: this.port,
        path: `${this.basePath}/health`,
        method: "GET",
        headers: {
          "User-Agent": "ChittyIDCore-ServerOnly/2.0",
        },
      };

      const req = this.protocol.request(requestOptions, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const response = JSON.parse(data);
            resolve({
              online: res.statusCode === 200,
              ...response,
            });
          } catch (parseError) {
            resolve({
              online: false,
              error: "Invalid health response",
            });
          }
        });
      });

      req.on("error", () => {
        resolve({
          online: false,
          error: "Server unreachable",
        });
      });

      req.setTimeout(2000, () => {
        req.destroy();
        resolve({
          online: false,
          error: "Health check timeout",
        });
      });

      req.end();
    });
  }
}

// Export for use in other modules
export default ChittyIDCore;
