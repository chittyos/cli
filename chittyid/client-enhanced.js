/**
 * Enhanced ChittyID Client with Security Hardening
 * Implements all client-side protections from elaborations
 */

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { ChittyIDClient } from "./client.js";

export class EnhancedChittyIDClient extends ChittyIDClient {
  constructor(config = {}) {
    super(config);

    // Client integrity
    this.clientVersion = "2.0.0";
    this.integrityHash = null;
    this.lastIntegrityCheck = 0;

    // Secure state storage
    this.stateFile =
      config.stateFile ||
      path.join(process.env.HOME || "/tmp", ".chittyid", "client-state.enc");
    this.encryptionKey = this.deriveKey(
      config.apiKey || process.env.CHITTY_API_KEY,
    );

    // Dynamic API key support
    this.keyRotationInterval = config.keyRotationInterval || 3600000; // 1 hour
    this.lastKeyRotation = Date.now();
    this.shortLivedKey = null;

    // Tamper detection
    this.initializeIntegrity();
  }

  /**
   * Initialize client integrity checking
   */
  async initializeIntegrity() {
    try {
      // Calculate hash of critical client code
      const clientCode = await fs.readFile(
        import.meta.url.replace("file://", ""),
        "utf8",
      );
      this.integrityHash = crypto
        .createHash("sha256")
        .update(clientCode)
        .digest("hex");

      // Store reference hash
      await this.secureStore("integrity", {
        hash: this.integrityHash,
        timestamp: Date.now(),
        version: this.clientVersion,
      });
    } catch (error) {
      console.error("Integrity initialization failed:", error);
    }
  }

  /**
   * Runtime integrity check
   */
  async verifyIntegrity() {
    const now = Date.now();

    // Check every 5 minutes
    if (now - this.lastIntegrityCheck < 300000) {
      return true;
    }

    try {
      const currentCode = await fs.readFile(
        import.meta.url.replace("file://", ""),
        "utf8",
      );
      const currentHash = crypto
        .createHash("sha256")
        .update(currentCode)
        .digest("hex");

      if (currentHash !== this.integrityHash) {
        // Critical: Code has been tampered with
        throw new Error("CLIENT_INTEGRITY_VIOLATION: Code has been modified");
      }

      this.lastIntegrityCheck = now;
      return true;
    } catch (error) {
      console.error("Integrity check failed:", error);
      // Fail closed - don't allow operations if integrity can't be verified
      throw error;
    }
  }

  /**
   * Request ChittyID with enhanced security
   */
  async requestChittyID(options = {}) {
    // Perform integrity check
    await this.verifyIntegrity();

    // Check for key rotation
    await this.rotateKeyIfNeeded();

    // Add client metadata for server validation
    const enhancedOptions = {
      ...options,
      clientMetadata: {
        version: this.clientVersion,
        integrityHash: this.integrityHash,
        timestamp: Date.now(),
        userAgent: this.getSecureUserAgent(),
      },
    };

    // Include HMAC signature for request
    const signature = this.signRequest(enhancedOptions);

    const requestData = {
      ...enhancedOptions,
      signature,
      apiKey: this.shortLivedKey || this.apiKey,
    };

    try {
      const response = await super.requestChittyID(requestData);

      // Store in secure state
      await this.secureStore(`id_${response.identifier}`, {
        ...response,
        requestTime: Date.now(),
      });

      return response;
    } catch (error) {
      // Log failure for anomaly detection
      await this.logSecurityEvent("REQUEST_FAILED", {
        error: error.message,
        options: enhancedOptions,
      });
      throw error;
    }
  }

  /**
   * Dynamic API key rotation
   */
  async rotateKeyIfNeeded() {
    const now = Date.now();

    if (now - this.lastKeyRotation > this.keyRotationInterval) {
      try {
        // Request new short-lived key from server
        const response = await this.requestNewKey();
        this.shortLivedKey = response.key;
        this.lastKeyRotation = now;

        await this.secureStore("keyRotation", {
          key: this.shortLivedKey,
          expires: response.expires,
          rotatedAt: now,
        });
      } catch (error) {
        console.error("Key rotation failed:", error);
        // Continue with existing key
      }
    }
  }

  /**
   * Request new short-lived API key
   */
  async requestNewKey() {
    // This would call a dedicated key rotation endpoint
    const response = await fetch(`${this.serverUrl}/api/v2/keys/rotate`, {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey,
        "X-Client-Version": this.clientVersion,
      },
      body: JSON.stringify({
        integrityHash: this.integrityHash,
      }),
    });

    if (!response.ok) {
      throw new Error("Key rotation request failed");
    }

    return response.json();
  }

  /**
   * Sign request with HMAC
   */
  signRequest(data) {
    const payload = JSON.stringify(data);
    const key = this.shortLivedKey || this.apiKey;

    return crypto.createHmac("sha256", key).update(payload).digest("hex");
  }

  /**
   * Secure state storage with encryption
   */
  async secureStore(key, value) {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.stateFile);
      await fs.mkdir(dir, { recursive: true });

      // Read existing state
      let state = {};
      try {
        const encrypted = await fs.readFile(this.stateFile, "utf8");
        state = this.decrypt(encrypted);
      } catch (error) {
        // File doesn't exist yet
      }

      // Update state
      state[key] = value;
      state.lastUpdated = Date.now();

      // Encrypt and write
      const encrypted = this.encrypt(state);
      await fs.writeFile(this.stateFile, encrypted, "utf8");
    } catch (error) {
      console.error("Secure store failed:", error);
    }
  }

  /**
   * Retrieve from secure storage
   */
  async secureRetrieve(key) {
    try {
      const encrypted = await fs.readFile(this.stateFile, "utf8");
      const state = this.decrypt(encrypted);
      return state[key];
    } catch (error) {
      return null;
    }
  }

  /**
   * Encrypt data for storage
   */
  encrypt(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.encryptionKey, iv);

    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), "utf8"),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      encrypted: encrypted.toString("hex"),
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    });
  }

  /**
   * Decrypt stored data
   */
  decrypt(encryptedData) {
    const { encrypted, iv, authTag } = JSON.parse(encryptedData);

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      this.encryptionKey,
      Buffer.from(iv, "hex"),
    );

    decipher.setAuthTag(Buffer.from(authTag, "hex"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "hex")),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8"));
  }

  /**
   * Derive encryption key from API key
   */
  deriveKey(apiKey) {
    return crypto
      .createHash("sha256")
      .update(apiKey + ":chittyid:encryption")
      .digest();
  }

  /**
   * Get secure user agent string
   */
  getSecureUserAgent() {
    return `ChittyIDClient/${this.clientVersion} (${process.platform}; Integrity:${this.integrityHash?.substring(0, 8)})`;
  }

  /**
   * Log security events for audit
   */
  async logSecurityEvent(eventType, data) {
    const event = {
      type: eventType,
      timestamp: Date.now(),
      clientVersion: this.clientVersion,
      integrityHash: this.integrityHash,
      data,
    };

    // Store locally
    await this.secureStore(`event_${Date.now()}`, event);

    // Send to server (if available)
    try {
      await fetch(`${this.serverUrl}/api/v2/security/events`, {
        method: "POST",
        headers: {
          "X-API-Key": this.shortLivedKey || this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      // Silent fail - don't block operations
    }
  }

  /**
   * Code obfuscation marker
   * In production, this class would be obfuscated/minified
   */
  static obfuscate() {
    // Production build would apply:
    // - Variable renaming
    // - String encryption
    // - Control flow flattening
    // - Dead code injection
    return "OBFUSCATED";
  }

  /**
   * Prevent debugging (production only)
   */
  antiDebug() {
    if (process.env.NODE_ENV === "production") {
      // Detect debugger
      const start = Date.now();
      debugger;
      const elapsed = Date.now() - start;

      if (elapsed > 100) {
        throw new Error("SECURITY_VIOLATION: Debugger detected");
      }

      // Prevent console access
      const methods = ["log", "debug", "info", "warn", "error"];
      methods.forEach((method) => {
        console[method] = () => {};
      });
    }
  }
}

// Export enhanced client
export default EnhancedChittyIDClient;
