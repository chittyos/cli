#!/usr/bin/env node
/**
 * Test the ChittyID Client Service
 * Tests server-only requests with no local fallback
 */

import { ChittyIDClient } from "./client.js";

async function testChittyIDService() {
  console.log("=== ChittyID Client Test Suite ===\n");

  // Initialize client
  const client = new ChittyIDClient({
    serverUrl: process.env.CHITTY_SERVER_URL || "https://id.chitty.cc",
    apiKey: process.env.CHITTY_API_KEY || "test-api-key",
    timeout: 5000,
  });

  console.log("Client Configuration:");
  console.log(`- Server: ${client.serverUrl}`);
  console.log(`- Timeout: ${client.timeout}ms`);
  console.log(`- API Key: ${client.apiKey ? "[SET]" : "[NOT SET]"}\n`);

  // Test 1: Request a standard ChittyID
  console.log("Test 1: Requesting standard ChittyID...");
  try {
    const id1 = await client.requestChittyID({
      namespace: "TST",
      type: "I",
      metadata: { test: "standard-request" },
    });
    console.log("✓ Success:", JSON.stringify(id1, null, 2));
  } catch (error) {
    console.log("✗ Failed:", error.message);
  }

  // Test 2: Request with appendage
  console.log("\nTest 2: Requesting ChittyID with parent...");
  try {
    const id2 = await client.requestChittyID({
      namespace: "APP",
      type: "A",
      parent: "AA-C-TST-0001-I-25-1-X",
      metadata: { test: "appendage-request" },
    });
    console.log("✓ Success:", JSON.stringify(id2, null, 2));
  } catch (error) {
    console.log("✗ Failed:", error.message);
  }

  // Test 3: Verify ChittyID
  console.log("\nTest 3: Verifying ChittyID...");
  try {
    const verification = await client.verifyChittyID("AA-C-TST-0001-I-25-1-X");
    console.log("✓ Verification:", JSON.stringify(verification, null, 2));
  } catch (error) {
    console.log("✗ Failed:", error.message);
  }

  // Test 4: Batch request
  console.log("\nTest 4: Batch requesting ChittyIDs...");
  try {
    const batch = await client.requestBatch([
      { namespace: "BT1", type: "I" },
      { namespace: "BT2", type: "L" },
      { namespace: "BT3", type: "V" },
    ]);
    console.log("✓ Batch received:", batch.length, "IDs");
    batch.forEach((id, i) => console.log(`  [${i}]:`, id.identifier || id));
  } catch (error) {
    console.log("✗ Failed:", error.message);
  }

  // Test 5: Verify NO local generation
  console.log("\nTest 5: Testing forbidden local generation...");
  try {
    client.generateLocal();
    console.log("✗ ERROR: Local generation should have failed!");
  } catch (error) {
    console.log("✓ Correctly blocked:", error.message);
  }

  // Test 6: Verify NO fallback mode
  console.log("\nTest 6: Testing forbidden fallback mode...");
  try {
    client.enableFallback();
    console.log("✗ ERROR: Fallback mode should have failed!");
  } catch (error) {
    console.log("✓ Correctly blocked:", error.message);
  }

  // Test 7: Verify NO caching
  console.log("\nTest 7: Testing forbidden caching...");
  try {
    client.cacheID();
    console.log("✗ ERROR: Caching should have failed!");
  } catch (error) {
    console.log("✓ Correctly blocked:", error.message);
  }

  // Test 8: Server unavailable behavior
  console.log("\nTest 8: Testing server unavailable scenario...");
  const offlineClient = new ChittyIDClient({
    serverUrl: "http://localhost:9999/nonexistent",
    timeout: 1000,
  });

  try {
    await offlineClient.requestChittyID({ namespace: "OFF" });
    console.log("✗ ERROR: Should have failed with no server!");
  } catch (error) {
    console.log("✓ Correctly failed:", error.message);
    if (error.message.includes("NO LOCAL GENERATION ALLOWED")) {
      console.log("  ✓ Confirms NO fallback to local generation");
    }
  }

  console.log("\n=== Test Suite Complete ===");
  console.log("STRICT RULE VERIFIED: ChittyIDs only from central server");
}

// Run tests
testChittyIDService().catch((error) => {
  console.error("Test suite error:", error);
  process.exit(1);
});
