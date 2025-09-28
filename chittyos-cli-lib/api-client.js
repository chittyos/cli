/**
 * ChittyAPI Client Module
 * Handles all API communications
 */

import { logger } from "./utils.js";

export class ChittyAPI {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": `ChittyCLI/2.1.0`,
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
      headers: { Authorization: `Bearer ${this.apiKey}` },
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
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
    });
  }

  // Browser rendering
  async captureWebsite(chittyId, url, options = {}) {
    return await this.request("/api/v1/capture/web", {
      method: "POST",
      body: JSON.stringify({ chittyId, url, options }),
    });
  }

  // Image processing
  async processImage(chittyId, imagePath, options = {}) {
    const formData = new FormData();
    const fileBuffer = await fs.readFile(imagePath);
    const blob = new Blob([fileBuffer]);

    formData.append("image", blob, path.basename(imagePath));
    formData.append("metadata", JSON.stringify({ chittyId, ...options }));

    return await this.request("/api/v1/image/process", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
    });
  }

  // Privacy protection
  async protectPII(chittyId, data, options = {}) {
    return await this.request("/api/v1/privacy/protect", {
      method: "POST",
      body: JSON.stringify({ chittyId, data, context: options }),
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
