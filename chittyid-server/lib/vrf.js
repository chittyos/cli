/**
 * Verifiable Random Function (VRF) for ChittyID
 * Implements the cryptographic SSSS generation from research document
 */

import crypto from "crypto";

export class ChittyVRF {
  /**
   * Generate SSSS field using VRF with drand
   * @param {Object} params - VRF parameters
   * @returns {string} 4-digit SSSS field
   */
  static generateSSSS(params) {
    const {
      drandValue,
      drandRound,
      contentHash,
      namespace,
      type,
      component,
      counter = crypto.randomBytes(4).toString("hex"),
    } = params;

    // Combine all inputs for VRF calculation (as per research doc page 4)
    const vrfInput = [
      drandValue,
      drandRound.toString(),
      contentHash || "",
      namespace,
      type,
      component,
      counter,
    ].join(":");

    // Generate hash using SHA256
    const hashOutput = crypto.createHash("sha256").update(vrfInput).digest();

    // Convert to numeric value and apply modulo for 4 digits
    const numericValue = BigInt("0x" + hashOutput.toString("hex"));
    const ssss = (numericValue % 10000n).toString().padStart(4, "0");

    return ssss;
  }

  /**
   * Calculate ChittyID checksum (X field)
   * Includes content binding as per research
   */
  static calculateChecksum(baseId, contentHash, drandValue) {
    const checksumInput = [baseId, contentHash || "", drandValue || ""].join(
      ":",
    );

    const hash = crypto
      .createHash("sha256")
      .update(checksumInput)
      .digest("hex");

    // Take first character of hash, convert to uppercase
    // This provides 16 possible checksum values (0-9, A-F)
    return hash.charAt(0).toUpperCase();
  }

  /**
   * Generate Year/Month encoding (YM field)
   */
  static generateYM() {
    const now = new Date();
    const year = now.getFullYear() % 100; // Last 2 digits of year
    const month = now.getMonth() + 1; // 1-12

    // Encode as base36 for compact representation
    const encoded = (year * 12 + month).toString(36).toUpperCase();
    return encoded.padStart(2, "0").substring(0, 2);
  }

  /**
   * Verify SSSS field matches expected VRF output
   */
  static verifySSSS(ssss, params) {
    const expected = this.generateSSSS(params);
    return ssss === expected;
  }

  /**
   * Generate error code for fallback IDs
   * Embeds specific error codes in SSSS field
   */
  static generateErrorSSSS(errorCode, drandValue) {
    // For fallback IDs, embed error code while maintaining randomness
    // Format: ECXX where EC is error code, XX is random
    const errorPrefix = String(errorCode).padStart(2, "0");
    const randomSuffix = crypto.randomBytes(1).readUInt8(0) % 100;

    return errorPrefix + String(randomSuffix).padStart(2, "0");
  }
}
