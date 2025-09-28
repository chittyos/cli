/**
 * ChittyID VRF Client - STRICT SERVER-ONLY VERSION
 *
 * SECURITY UPDATE: This file has been updated to enforce server-only operations.
 * Previous versions contained local generation which violated security policy.
 *
 * ALL VRF operations must be performed by authorized servers only.
 * NO LOCAL GENERATION - NO EXCEPTIONS
 */

export class ChittyVRF {
  constructor(config = {}) {
    this.serverUrl =
      config.serverUrl ||
      process.env.CHITTY_SERVER_URL ||
      "https://id.chitty.cc";
    this.apiKey = config.apiKey || process.env.CHITTY_API_KEY;

    if (!this.apiKey) {
      console.warn(
        "WARNING: CHITTY_API_KEY not configured. " +
          "VRF requests will fail. " +
          "NO LOCAL GENERATION IS AVAILABLE.",
      );
    }
  }

  /**
   * Request VRF calculation from server - NO LOCAL GENERATION
   * @param {Object} params - VRF parameters
   * @returns {Promise<string>} Server-generated SSSS field
   */
  async generateSSSS(params) {
    if (!this.apiKey) {
      throw new Error(
        "CHITTYID_ERROR: API key required. " +
          "Configure CHITTY_API_KEY environment variable. " +
          "NO LOCAL GENERATION AVAILABLE.",
      );
    }

    try {
      const response = await fetch(`${this.serverUrl}/api/v2/vrf/ssss`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "X-ChittyOS-Pipeline": "Router→Intake→Trust→Authorization→Generation",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Server VRF generation failed: ${error.error || response.statusText}. ` +
            "NO LOCAL GENERATION AVAILABLE.",
        );
      }

      const result = await response.json();
      return result.ssss;
    } catch (error) {
      throw new Error(
        `VRF generation failed: ${error.message}. ` +
          "NO LOCAL GENERATION AVAILABLE. " +
          "Ensure server connectivity to " +
          this.serverUrl,
      );
    }
  }

  /**
   * Request checksum calculation from server - NO LOCAL CALCULATION
   */
  async calculateChecksum(baseId, contentHash, drandValue) {
    if (!this.apiKey) {
      throw new Error(
        "CHITTYID_ERROR: API key required for checksum calculation",
      );
    }

    try {
      const response = await fetch(`${this.serverUrl}/api/v2/vrf/checksum`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ baseId, contentHash, drandValue }),
      });

      if (!response.ok) {
        throw new Error(`Checksum calculation failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.checksum;
    } catch (error) {
      throw new Error(`Checksum calculation failed: ${error.message}`);
    }
  }

  /**
   * REMOVED METHODS - NO LOCAL OPERATIONS
   * The following methods have been removed as they violated security policy:
   * - generateSSSS() - Local SSSS generation
   * - calculateChecksum() - Local checksum calculation
   * - generateYM() - Local time calculation
   * - verifySSSS() - Local verification
   * - generateErrorSSSS() - Local error code generation
   *
   * ALL VRF operations MUST go through the server
   */

  /**
   * Legacy method - throws error directing to server
   */
  static generateSSSS() {
    throw new Error(
      "LOCAL CALCULATION REMOVED: This method has been removed for security. " +
        "All VRF operations must use the server at https://id.chitty.cc",
    );
  }

  static calculateChecksum() {
    throw new Error(
      "LOCAL CALCULATION REMOVED: This method has been removed for security. " +
        "All VRF operations must use the server at https://id.chitty.cc",
    );
  }

  static generateYM() {
    throw new Error(
      "LOCAL CALCULATION REMOVED: This method has been removed for security. " +
        "All VRF operations must use the server at https://id.chitty.cc",
    );
  }

  static verifySSSS() {
    throw new Error(
      "LOCAL VERIFICATION REMOVED: This method has been removed for security. " +
        "All VRF operations must use the server at https://id.chitty.cc",
    );
  }

  static generateErrorSSSS() {
    throw new Error(
      "LOCAL GENERATION REMOVED: This method has been removed for security. " +
        "All VRF operations must use the server at https://id.chitty.cc",
    );
  }
}
