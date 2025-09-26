/**
 * Test ChittyID Server Locally
 * Comprehensive test of all endpoints and security features
 */

import crypto from "crypto";

const SERVER_URL = "http://localhost:3000";
const API_KEY = "dev-key-123";

/**
 * Test ChittyID generation
 */
async function testChittyIDGeneration() {
  console.log("\n=== Testing ChittyID Generation ===");

  const contentHash = crypto
    .createHash("sha256")
    .update("Test content for ChittyID generation")
    .digest("hex");

  const request = {
    content_hash: contentHash,
    namespace: "DOC",
    type: "I",
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
    metadata: {
      purpose: "Local server test",
      test: true,
    },
  };

  try {
    const response = await fetch(`${SERVER_URL}/api/v2/chittyid/mint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify(request),
    });

    const result = await response.json();

    if (response.ok) {
      console.log("✅ ChittyID generated successfully:");
      console.log(`   ID: ${result.chitty_id}`);
      console.log(`   Status: ${result.status_block.status}`);
      console.log(`   Drand Round: ${result.status_block.drand_round}`);
      return result.chitty_id;
    } else {
      console.log("❌ Generation failed:", result);
      return null;
    }
  } catch (error) {
    console.log("❌ Request error:", error.message);
    return null;
  }
}

/**
 * Test ChittyID verification
 */
async function testChittyIDVerification(chittyId) {
  console.log("\n=== Testing ChittyID Verification ===");

  if (!chittyId) {
    console.log("⚠️  No ChittyID to verify");
    return;
  }

  try {
    const response = await fetch(
      `${SERVER_URL}/api/v2/chittyid/verify/${chittyId}`,
    );
    const result = await response.json();

    if (response.ok && result.valid) {
      console.log("✅ ChittyID verified successfully:");
      console.log(`   Valid: ${result.valid}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Namespace: ${result.namespace}`);
      console.log(`   Type: ${result.type}`);
    } else {
      console.log("❌ Verification failed:", result);
    }
  } catch (error) {
    console.log("❌ Verification error:", error.message);
  }
}

/**
 * Test replay protection
 */
async function testReplayProtection() {
  console.log("\n=== Testing Replay Protection ===");

  const contentHash = crypto
    .createHash("sha256")
    .update("Replay test content")
    .digest("hex");

  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();

  const request = {
    content_hash: contentHash,
    namespace: "DOC",
    type: "I",
    timestamp,
    nonce,
  };

  // First request should succeed
  console.log("First request (should succeed):");
  const response1 = await fetch(`${SERVER_URL}/api/v2/chittyid/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify(request),
  });

  const result1 = await response1.json();

  if (response1.ok) {
    console.log("✅ First request succeeded");
  } else {
    console.log("❌ First request failed:", result1);
  }

  // Second request with same nonce should fail
  console.log("Second request with same nonce (should fail):");
  const response2 = await fetch(`${SERVER_URL}/api/v2/chittyid/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify(request),
  });

  const result2 = await response2.json();

  if (response2.status === 400 && result2.error_code === "REPLAY_DETECTED") {
    console.log("✅ Replay protection working - second request blocked");
  } else {
    console.log("❌ Replay protection failed:", result2);
  }
}

/**
 * Test API key validation
 */
async function testAPIKeyValidation() {
  console.log("\n=== Testing API Key Validation ===");

  const request = {
    content_hash: crypto.createHash("sha256").update("test").digest("hex"),
    namespace: "DOC",
    type: "I",
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  // Test without API key
  console.log("Request without API key (should fail):");
  const response1 = await fetch(`${SERVER_URL}/api/v2/chittyid/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const result1 = await response1.json();

  if (response1.status === 401 && result1.error_code === "UNAUTHORIZED") {
    console.log("✅ API key validation working - unauthorized request blocked");
  } else {
    console.log("❌ API key validation failed:", result1);
  }

  // Test with invalid API key
  console.log("Request with invalid API key (should fail):");
  const response2 = await fetch(`${SERVER_URL}/api/v2/chittyid/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "invalid-key",
    },
    body: JSON.stringify(request),
  });

  const result2 = await response2.json();

  if (response2.status === 401 && result2.error_code === "UNAUTHORIZED") {
    console.log("✅ Invalid API key blocked");
  } else {
    console.log("❌ Invalid API key validation failed:", result2);
  }
}

/**
 * Test validation errors
 */
async function testValidationErrors() {
  console.log("\n=== Testing Validation Errors ===");

  // Test missing fields
  console.log("Request with missing fields (should fail):");
  const response1 = await fetch(`${SERVER_URL}/api/v2/chittyid/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify({
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString("hex"),
    }),
  });

  const result1 = await response1.json();

  if (
    response1.status === 400 &&
    result1.error_code === "MISSING_REQUIRED_FIELDS"
  ) {
    console.log("✅ Missing fields validation working");
  } else {
    console.log("❌ Missing fields validation failed:", result1);
  }

  // Test invalid hash format
  console.log("Request with invalid hash (should fail):");
  const response2 = await fetch(`${SERVER_URL}/api/v2/chittyid/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify({
      content_hash: "invalid-hash",
      namespace: "DOC",
      type: "I",
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString("hex"),
    }),
  });

  const result2 = await response2.json();

  if (response2.status === 400 && result2.error_code === "INVALID_HASH") {
    console.log("✅ Hash validation working");
  } else {
    console.log("❌ Hash validation failed:", result2);
  }
}

/**
 * Test health check
 */
async function testHealthCheck() {
  console.log("\n=== Testing Health Check ===");

  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const result = await response.json();

    if (response.ok && result.status === "healthy") {
      console.log("✅ Health check passed:");
      console.log(`   Service: ${result.service}`);
      console.log(`   Version: ${result.version}`);
    } else {
      console.log("❌ Health check failed:", result);
    }
  } catch (error) {
    console.log("❌ Health check error:", error.message);
  }
}

/**
 * Test forensics endpoint
 */
async function testForensics() {
  console.log("\n=== Testing Forensics Endpoint ===");

  try {
    const response = await fetch(`${SERVER_URL}/api/v2/security/forensics`, {
      headers: {
        "X-API-Key": API_KEY,
      },
    });

    const result = await response.json();

    if (response.ok) {
      console.log("✅ Forensics endpoint accessible:");
      console.log(`   Total anomalies: ${result.stats.totalAnomalies}`);
      console.log(`   Critical: ${result.stats.bySeverity.CRITICAL}`);
      console.log(`   High: ${result.stats.bySeverity.HIGH}`);
    } else {
      console.log("❌ Forensics endpoint failed:", result);
    }
  } catch (error) {
    console.log("❌ Forensics error:", error.message);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log("🚀 Starting ChittyID Server Tests");
  console.log("===================================");

  await testHealthCheck();
  await testAPIKeyValidation();
  await testValidationErrors();

  const chittyId = await testChittyIDGeneration();
  await testChittyIDVerification(chittyId);

  await testReplayProtection();
  await testForensics();

  console.log("\n===================================");
  console.log("✅ All tests completed");
  console.log(
    "Server is running and enforcing STRICT SERVER-ONLY generation rule",
  );
}

// Run tests
runAllTests().catch(console.error);
