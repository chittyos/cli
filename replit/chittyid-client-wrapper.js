/**
 * ChittyID Client Wrapper for Replit Components
 * Replaces all local generation with server requests
 */

import { ChittyIDClient } from "../chittyid/client.js";

// Create singleton client instance
const chittyClient = new ChittyIDClient({
  serverUrl: process.env.CHITTY_SERVER_URL || "https://chittyid.chittycorp.com",
  apiKey: process.env.CHITTY_API_KEY,
  timeout: 5000,
});

/**
 * Request ChittyID from server - replaces generateChittyID
 */
export async function requestChittyID(options = {}) {
  try {
    const response = await chittyClient.requestChittyID({
      namespace: options.namespace || "GEN",
      type: options.type || "I",
      parent: options.parent,
      metadata: options.metadata || {},
    });

    return response;
  } catch (error) {
    // NO FALLBACK - fail if server unavailable
    throw new Error(`ChittyID server request failed: ${error.message}`);
  }
}

/**
 * Verify ChittyID with server - replaces parseChittyID
 */
export async function verifyChittyID(chittyId) {
  try {
    const response = await chittyClient.verifyChittyID(chittyId);
    return response;
  } catch (error) {
    throw new Error(`ChittyID verification failed: ${error.message}`);
  }
}

/**
 * Batch request ChittyIDs
 */
export async function requestBatchChittyIDs(requests) {
  try {
    const response = await chittyClient.requestBatch(requests);
    return response;
  } catch (error) {
    throw new Error(`Batch ChittyID request failed: ${error.message}`);
  }
}

// Export client for direct use
export { chittyClient };

// Default export with all methods
export default {
  requestChittyID,
  verifyChittyID,
  requestBatchChittyIDs,
  client: chittyClient,
};
