#!/usr/bin/env node

// ChittyCorp LLC Production Configuration
export const CHITTYCORP_CONFIG = {
  workerId: "0bc21e3a5a9de1a4cc843be9c3e98121",
  baseUrl: "https://chitty-unified.chittycorp.workers.dev",
  apiUrl: "https://api.cloudflare.com/client/v4",
  workerUrl:
    "https://0bc21e3a5a9de1a4cc843be9c3e98121.chitty-unified.workers.dev",
  domain: "chittycorp.workers.dev",
  // API endpoints for different services
  endpoints: {
    workflow: "/api/workflow",
    intake: "/api/intake",
    mint: "/api/mint",
    pipeline: "/api/pipeline",
    vectorize: "/api/vectorize",
    ai: "/api/ai",
  },
};

// ChittyCorp API Helper
export class ChittyCorpAPI {
  constructor(config = CHITTYCORP_CONFIG) {
    this.config = config;
  }

  async makeRequest(endpoint, data = {}, method = "POST") {
    try {
      const url = `${this.config.workerUrl}${endpoint}`;
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Worker-ID": this.config.workerId,
          "User-Agent": "ChittyOS-CLI/1.0.0",
        },
        body: method !== "GET" ? JSON.stringify(data) : undefined,
      });

      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`ChittyCorp API error: ${response.status}`);
      }
    } catch (error) {
      console.warn(`ChittyCorp API unavailable: ${error.message}`);
      return null;
    }
  }

  async createWorkflow(name, options) {
    return this.makeRequest(this.config.endpoints.workflow + "/create", {
      name,
      workflowId: `workflow-${name}-${Date.now()}`,
      ...options,
    });
  }

  async submitIntake(options) {
    return this.makeRequest(this.config.endpoints.intake + "/submit", options);
  }

  async performMint(action, subject, options) {
    return this.makeRequest(this.config.endpoints.mint + `/${action}`, {
      subject,
      ...options,
    });
  }
}
