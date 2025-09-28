/**
 * ChittyOS Ultimate Worker - Service Router
 * Central routing for all ChittyOS services across 73 domains
 */

import { platformHandler } from "./services/platform";
import { bridgeHandler } from "./services/bridge";
import { consultantHandler } from "./services/consultant";
import { chainHandler } from "./services/chain";
import { ctoHandler } from "./services/cto";
import { legalHandler } from "./services/legal";
import { financeHandler } from "./services/finance";
import { propertyHandler } from "./services/property";
import { evidenceHandler } from "./services/evidence";
import { booksHandler } from "./services/books";
import { assetsHandler } from "./services/assets";
import { mintHandler } from "./services/mint";
import { registryHandler } from "./services/registry";
import { gatewayHandler } from "./services/gateway";
import { schemaHandler } from "./services/schema";
import { canonHandler } from "./services/canon";
import { chatHandler } from "./services/chat";
import { complianceHandler } from "./services/compliance";
import { trustHandler } from "./services/trust";
import { verifyHandler } from "./services/verify";
import { syncHandler } from "./services/sync";
import { casesHandler } from "./services/cases";
import { documentsHandler } from "./services/documents";

export interface Env {
  KV_NAMESPACE: KVNamespace;
  D1_DATABASE: D1Database;
  R2_BUCKET: R2Bucket;
  QUEUE: Queue;
  DURABLE_OBJECT: DurableObjectNamespace;
  // API Keys
  CHITTY_API_KEY: string;
  NOTION_TOKEN: string;
  STRIPE_SECRET_KEY: string;
  DOCUSIGN_ACCESS_TOKEN: string;
  BLOCKCHAIN_RPC_URL: string;
  CHITTY_CONTRACT_ADDRESS: string;
}

export const serviceRoutes = {
  // Core platform services
  "/platform": platformHandler,
  "/bridge": bridgeHandler,
  "/consultant": consultantHandler,
  "/chain": chainHandler,
  "/cto": ctoHandler,

  // Legal and compliance services
  "/legal": legalHandler,
  "/cases": casesHandler,
  "/documents": documentsHandler,
  "/compliance": complianceHandler,
  "/evidence": evidenceHandler,

  // Financial services
  "/finance": financeHandler,
  "/books": booksHandler,
  "/mint": mintHandler,

  // Asset and property management
  "/property": propertyHandler,
  "/assets": assetsHandler,
  "/registry": registryHandler,

  // Infrastructure services
  "/gateway": gatewayHandler,
  "/schema": schemaHandler,
  "/canon": canonHandler,

  // Communication and verification
  "/chat": chatHandler,
  "/trust": trustHandler,
  "/verify": verifyHandler,
  "/sync": syncHandler,

  // Health and monitoring
  "/health": async () => new Response("OK", { status: 200 }),
  "/status": async (req: Request, env: Env) => {
    const services = Object.keys(serviceRoutes);
    return Response.json({
      status: "operational",
      services: services.length,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    });
  },
};

// Main worker entry point
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for browser requests
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Extract service path
      const pathPrefix = "/" + url.pathname.split("/")[1];

      // Route to appropriate handler
      const handler = serviceRoutes[pathPrefix];
      if (handler) {
        const response = await handler(request, env, url.pathname);

        // Add CORS headers to response
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });

        return response;
      }

      // 404 for unknown routes
      return new Response(
        JSON.stringify({
          error: "Service not found",
          available: Object.keys(serviceRoutes),
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    } catch (error) {
      // Global error handler
      console.error("Worker error:", error);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }
  },

  // Scheduled worker for maintenance tasks
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    switch (event.cron) {
      case "0 */6 * * *": // Every 6 hours
        await performHealthCheck(env);
        break;
      case "0 0 * * *": // Daily at midnight
        await performDailyCleanup(env);
        break;
    }
  },

  // Queue consumer for async tasks
  async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext) {
    for (const message of batch.messages) {
      try {
        await processQueueMessage(message, env);
        message.ack();
      } catch (error) {
        console.error("Queue processing error:", error);
        message.retry();
      }
    }
  },
};

// Helper functions
async function performHealthCheck(env: Env) {
  const results = [];
  for (const [path, handler] of Object.entries(serviceRoutes)) {
    if (typeof handler === "function") {
      try {
        const testRequest = new Request(`https://chittyos.com${path}/health`);
        const response = await handler(testRequest, env, `${path}/health`);
        results.push({
          service: path,
          status: response.status === 200 ? "healthy" : "unhealthy",
          statusCode: response.status,
        });
      } catch (error) {
        results.push({
          service: path,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  // Store health check results
  await env.KV_NAMESPACE.put(
    "health:latest",
    JSON.stringify({
      timestamp: new Date().toISOString(),
      results,
    }),
    { expirationTtl: 86400 }, // 24 hours
  );
}

async function performDailyCleanup(env: Env) {
  // Clean up old KV entries
  const keysToDelete = [];
  const list = await env.KV_NAMESPACE.list({ prefix: "temp:" });

  for (const key of list.keys) {
    const metadata = key.metadata as any;
    if (metadata?.expiresAt && new Date(metadata.expiresAt) < new Date()) {
      keysToDelete.push(key.name);
    }
  }

  // Batch delete expired keys
  for (const key of keysToDelete) {
    await env.KV_NAMESPACE.delete(key);
  }

  console.log(`Cleanup completed: ${keysToDelete.length} keys deleted`);
}

async function processQueueMessage(message: Message<any>, env: Env) {
  const { type, payload } = message.body;

  switch (type) {
    case "LEGAL_WORKFLOW":
      await processLegalWorkflow(payload, env);
      break;
    case "FINANCIAL_TRANSACTION":
      await processFinancialTransaction(payload, env);
      break;
    case "DOCUMENT_PROCESSING":
      await processDocument(payload, env);
      break;
    default:
      console.warn(`Unknown message type: ${type}`);
  }
}

async function processLegalWorkflow(payload: any, env: Env) {
  // Orchestrate legal workflow across services
  const caseId = await createCase(payload, env);
  await anchorToBlockchain(caseId, env);
  await notifyStakeholders(caseId, payload, env);
}

async function processFinancialTransaction(payload: any, env: Env) {
  // Process financial transaction with compliance checks
  await validateTransaction(payload, env);
  await recordInLedger(payload, env);
  await updateBalances(payload, env);
}

async function processDocument(payload: any, env: Env) {
  // Process document with OCR and analysis
  await extractMetadata(payload, env);
  await analyzeContent(payload, env);
  await storeInR2(payload, env);
}

// Stub implementations for async processing
async function createCase(payload: any, env: Env): Promise<string> {
  const caseId = `CASE-${Date.now()}`;
  await env.KV_NAMESPACE.put(`case:${caseId}`, JSON.stringify(payload));
  return caseId;
}

async function anchorToBlockchain(caseId: string, env: Env) {
  // Blockchain anchoring logic
  console.log(`Anchoring case ${caseId} to blockchain`);
}

async function notifyStakeholders(caseId: string, payload: any, env: Env) {
  // Notification logic
  console.log(`Notifying stakeholders for case ${caseId}`);
}

async function validateTransaction(payload: any, env: Env) {
  // Transaction validation
  console.log("Validating transaction");
}

async function recordInLedger(payload: any, env: Env) {
  // Ledger recording
  console.log("Recording in ledger");
}

async function updateBalances(payload: any, env: Env) {
  // Balance updates
  console.log("Updating balances");
}

async function extractMetadata(payload: any, env: Env) {
  // Metadata extraction
  console.log("Extracting metadata");
}

async function analyzeContent(payload: any, env: Env) {
  // Content analysis
  console.log("Analyzing content");
}

async function storeInR2(payload: any, env: Env) {
  // R2 storage
  console.log("Storing in R2");
}
