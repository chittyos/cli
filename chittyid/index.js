/**
 * ChittyID Module - SERVER-ONLY REQUEST SYSTEM
 *
 * STRICT RULE: ChittyIDs are ONLY requested from central server
 * - NO local generation
 * - NO fallbacks
 * - NO caching
 * - NO offline mode
 */

import { ChittyIDClient, requestChittyID, verifyChittyID } from "./client.js";

// Re-export the client-only functionality
export { ChittyIDClient, requestChittyID, verifyChittyID };

// Default export
export default ChittyIDClient;
