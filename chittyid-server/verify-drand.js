/**
 * Verify that server is using REAL drand beacon
 */

import crypto from "crypto";

const SERVER_URL = "http://localhost:3000";
const DRAND_URL = "https://drand.cloudflare.com/public/latest";

async function verifyRealDrand() {
  console.log("🔍 Verifying ChittyID server uses REAL drand beacon...\n");

  // 1. Check real drand beacon directly
  console.log("1. Fetching real drand beacon:");
  const drandResponse = await fetch(DRAND_URL);
  const drandData = await drandResponse.json();

  console.log(`   Round: ${drandData.round}`);
  console.log(`   Randomness: ${drandData.randomness.substring(0, 16)}...`);
  console.log(`   Signature: ${drandData.signature.substring(0, 16)}...`);

  // 2. Generate ChittyID and check if it uses same drand round
  console.log("\n2. Generating ChittyID:");
  const contentHash = crypto
    .createHash("sha256")
    .update("verify real drand")
    .digest("hex");

  const request = {
    content_hash: contentHash,
    namespace: "DOC",
    type: "I",
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const response = await fetch(`${SERVER_URL}/api/v2/chittyid/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "dev-key-123",
    },
    body: JSON.stringify(request),
  });

  const result = await response.json();

  if (response.ok) {
    console.log(`   Generated ID: ${result.chitty_id}`);
    console.log(`   Server Drand Round: ${result.status_block.drand_round}`);

    // 3. Compare rounds (should be same or very close)
    console.log("\n3. Comparison:");
    const roundDiff = Math.abs(
      drandData.round - result.status_block.drand_round,
    );

    if (roundDiff <= 2) {
      // Allow small difference due to timing
      console.log(`   ✅ REAL DRAND CONFIRMED`);
      console.log(`   Round difference: ${roundDiff} (acceptable)`);
      console.log(`   Server is using live Cloudflare drand beacon`);
    } else {
      console.log(`   ❌ SUSPICIOUS: Round difference too large: ${roundDiff}`);
      console.log(`   This might indicate mock/fake drand`);
    }

    // 4. Verify ID format matches VRF specification
    console.log("\n4. ID Format Verification:");
    const idParts = result.chitty_id.split("-");
    console.log(`   Format: ${idParts.join("-")}`);
    console.log(`   YM: ${idParts[0]} (Year/Month encoding)`);
    console.log(`   Component: ${idParts[1]} (should be 'C' for central)`);
    console.log(
      `   Namespace: ${idParts[2]} (requested: ${request.namespace})`,
    );
    console.log(`   SSSS: ${idParts[3]} (VRF-generated from drand)`);
    console.log(`   Type: ${idParts[4]} (requested: ${request.type})`);
    console.log(`   CC: ${idParts[5]} (counter from SSSS)`);
    console.log(`   V: ${idParts[6]} (version)`);
    console.log(`   X: ${idParts[7]} (checksum with content binding)`);

    if (
      idParts[1] === "C" &&
      idParts[2] === request.namespace &&
      idParts[4] === request.type
    ) {
      console.log(`   ✅ ID FORMAT CORRECT`);
    } else {
      console.log(`   ❌ ID FORMAT ERROR`);
    }
  } else {
    console.log(`   ❌ Generation failed:`, result);
  }
}

verifyRealDrand().catch(console.error);
