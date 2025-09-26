#!/usr/bin/env node

// ChittyID Core Implementation
// Format: VV-G-LLL-SSSS-T-YM-C-X (Structured ID Format from spec)
// Uses Cloudflare's drand randomness beacon for verifiable randomness

import crypto from "crypto";
import https from "https";

export class ChittyIDCore {
  constructor() {
    this.version = "01"; // VV - Version
    this.nodeMap = new Map(); // For distributed node management
    this.drandCache = null; // Cache for drand randomness
    this.drandCacheTime = 0;
    this.drandCacheDuration = 30000; // 30 seconds cache
    this.lastRandomnessSource = null; // Track what source was actually used
    // Cloudflare drand beacon endpoint
    this.drandEndpoint = "https://drand.cloudflare.com/public/latest";
  }

  /**
   * Generate ChittyID with proper format: VV-G-LLL-SSSS-T-YM-C-X
   * ALWAYS attempts to use Cloudflare's drand randomness beacon first for consistency
   * @param {Object} options - Generation options
   * @param {string} options.namespace - Three-letter namespace (LLL)
   * @param {string} options.domain - Domain identifier (G)
   * @param {string} options.type - Type identifier (T)
   * @param {boolean} options.sync - Force synchronous generation (default: false)
   * @returns {Object|Promise<Object>} ChittyID object with identifier and metadata
   */
  async generateChittyID(options = {}) {
    const namespace = (options.namespace || "GEN")
      .substring(0, 3)
      .toUpperCase()
      .padEnd(3, "0");
    let domain = (options.domain || "C").substring(0, 1).toUpperCase(); // C = ChittyCorp
    const type = (options.type || "I").substring(0, 1).toUpperCase(); // I = Identity

    // ALWAYS attempt to use drand randomness first for consistency
    // Only use sync fallback if explicitly requested
    const sequence = options.sync
      ? this.generateSequenceSync()
      : await this.generateSequence(); // SSSS - 4 digit sequence
    const yearMonth = this.getYearMonth(); // YM - Year/Month encoding
    const component = options.sync
      ? this.generateComponentSync()
      : await this.generateComponent(); // C - Component identifier

    // If we had to fall back from drand, use error domain 'F' (Fallback) instead of 'C'
    // This makes it transparent that this ID wasn't generated with the primary randomness source
    if (
      !options.sync &&
      this.lastRandomnessSource === "fallback" &&
      domain === "C"
    ) {
      domain = "F"; // F = Fallback (used crypto instead of drand)
    }
    const checksum = this.calculateChecksum(
      this.version,
      domain,
      namespace,
      sequence,
      type,
      yearMonth,
      component,
    ); // X - Checksum

    const identifier = `${this.version}-${domain}-${namespace}-${sequence}-${type}-${yearMonth}-${component}-${checksum}`;

    return {
      identifier,
      version: this.version,
      domain,
      namespace,
      sequence,
      type,
      yearMonth,
      component,
      checksum,
      hex: this.toHex(identifier),
      timestamp: new Date().toISOString(),
      status: "Generated",
      // Indicate actual source used and whether domain was modified
      randomnessSource: options.sync
        ? "crypto.randomBytes"
        : this.lastRandomnessSource === "drand"
          ? "drand-beacon"
          : "crypto-fallback",
      domainNote:
        domain === "F"
          ? "Domain 'F' indicates fallback randomness was used (drand unavailable)"
          : domain === "E"
            ? "Domain 'E' indicates error/offline state"
            : "Standard domain",
    };
  }

  /**
   * Synchronous ChittyID generation (fallback when async not available)
   */
  generateChittyIDSync(options = {}) {
    return this.generateChittyID({ ...options, sync: true });
  }

  /**
   * Fetch randomness from Cloudflare's drand beacon
   * Always attempts to use drand for consistency
   */
  async fetchDrandRandomness() {
    const now = Date.now();

    // Use cached value if still fresh
    if (
      this.drandCache &&
      now - this.drandCacheTime < this.drandCacheDuration
    ) {
      return this.drandCache;
    }

    try {
      // ALWAYS attempt to fetch from Cloudflare's drand beacon with timeout
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Drand beacon timeout (2s)"));
        }, 2000); // 2 second timeout for quick fallback

        https
          .get(this.drandEndpoint, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              clearTimeout(timeout);
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(e);
              }
            });
          })
          .on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
      });

      // Cache the randomness
      this.drandCache = response.randomness;
      this.drandCacheTime = now;
      this.lastRandomnessSource = "drand";

      return response.randomness;
    } catch (error) {
      console.warn(
        "Failed to fetch drand randomness, falling back to crypto.randomBytes:",
        error.message,
      );
      // Fallback to crypto.randomBytes if drand is unavailable
      this.lastRandomnessSource = "fallback";
      return crypto.randomBytes(32).toString("hex");
    }
  }

  /**
   * Generate 4-digit sequence - ALWAYS attempts drand first for consistency
   */
  async generateSequence() {
    const timestamp = Date.now();

    try {
      // ALWAYS attempt to get verifiable randomness from Cloudflare's drand beacon
      const randomness = await this.fetchDrandRandomness();
      // Use first 8 hex chars of drand randomness
      const random = parseInt(randomness.substring(0, 8), 16) % 10000;
      return ((timestamp % 10000) + random)
        .toString()
        .substring(0, 4)
        .padStart(4, "0");
    } catch (error) {
      // Fallback only if drand is truly unavailable
      console.warn(`Drand unavailable, using fallback: ${error.message}`);
      const random = crypto.randomBytes(2).readUInt16BE(0) % 1000;
      return ((timestamp % 10000) + random)
        .toString()
        .substring(0, 4)
        .padStart(4, "0");
    }
  }

  /**
   * Synchronous fallback for sequence generation
   */
  generateSequenceSync() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(2).readUInt16BE(0) % 1000;
    this.lastRandomnessSource = "sync-fallback";
    return ((timestamp % 10000) + random)
      .toString()
      .substring(0, 4)
      .padStart(4, "0");
  }

  /**
   * Generate year/month encoding (YM)
   */
  getYearMonth() {
    const now = new Date();
    const year = now.getFullYear().toString().substring(2, 4); // Last 2 digits of year
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    return year + month.substring(1, 2); // Y + M (single digit month)
  }

  /**
   * Generate component identifier - ALWAYS attempts drand first for consistency
   */
  async generateComponent() {
    const components = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K"];

    try {
      // ALWAYS attempt drand first
      const randomness = await this.fetchDrandRandomness();
      // Use different part of drand randomness for component selection
      const index =
        parseInt(randomness.substring(8, 10), 16) % components.length;
      return components[index];
    } catch (error) {
      // Fallback only if drand is truly unavailable
      console.warn(
        `Drand unavailable for component, using fallback: ${error.message}`,
      );
      const index = crypto.randomBytes(1)[0] % components.length;
      return components[index];
    }
  }

  /**
   * Synchronous fallback for component generation
   */
  generateComponentSync() {
    const components = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K"];
    const index = crypto.randomBytes(1)[0] % components.length;
    this.lastRandomnessSource = "sync-fallback";
    return components[index];
  }

  /**
   * Calculate checksum using algorithm from spec
   */
  calculateChecksum(
    version,
    domain,
    namespace,
    sequence,
    type,
    yearMonth,
    component,
  ) {
    const combined = `${version}${domain}${namespace}${sequence}${type}${yearMonth}${component}`;
    const hash = crypto.createHash("md5").update(combined).digest("hex");
    return hash.substring(0, 1).toUpperCase();
  }

  /**
   * Convert ChittyID to hex representation
   */
  toHex(identifier) {
    return Buffer.from(identifier.replace(/-/g, ""), "utf8")
      .toString("hex")
      .toUpperCase();
  }

  /**
   * Validate ChittyID format and checksum
   */
  validateChittyID(identifier) {
    const pattern =
      /^(\d{2})-([A-Z])-([A-Z0-9]{3})-(\d{4})-([A-Z])-(\d{2,3})-([A-Z])-([A-Z0-9])$/;
    const match = identifier.match(pattern);

    if (!match) {
      return { valid: false, error: "Invalid ChittyID format" };
    }

    const [
      ,
      version,
      domain,
      namespace,
      sequence,
      type,
      yearMonth,
      component,
      checksum,
    ] = match;
    const calculatedChecksum = this.calculateChecksum(
      version,
      domain,
      namespace,
      sequence,
      type,
      yearMonth,
      component,
    );

    if (checksum !== calculatedChecksum) {
      return { valid: false, error: "Invalid checksum" };
    }

    return {
      valid: true,
      components: {
        version,
        domain,
        namespace,
        sequence,
        type,
        yearMonth,
        component,
        checksum,
      },
    };
  }

  /**
   * Parse ChittyID into components
   */
  parseChittyID(identifier) {
    const validation = this.validateChittyID(identifier);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return {
      identifier,
      ...validation.components,
      hex: this.toHex(identifier),
      humanReadable: this.toHumanReadable(validation.components),
    };
  }

  /**
   * Convert to human-readable format
   */
  toHumanReadable(components) {
    const namespaceMap = {
      MNT: "Mint",
      EVD: "Evidence",
      CLM: "Claim",
      USR: "User",
      DOC: "Document",
      LEG: "Legal",
      BLK: "Blockchain",
      GEN: "General",
      DIS: "Disconnected",
      PSY: "PendingSync",
      LOC: "LocalOnly",
      AWM: "AwaitingMint",
      TMP: "Temporary",
    };

    const typeMap = {
      I: "Identity",
      D: "Document",
      C: "Claim",
      E: "Evidence",
      M: "Mint",
      P: "Payment",
    };

    const domainMap = {
      C: "ChittyCorp",
      E: "Error/Offline",
      F: "Fallback/NoBeacon",
    };

    return {
      version: `v${components.version}`,
      domain: domainMap[components.domain] || components.domain,
      namespace: namespaceMap[components.namespace] || components.namespace,
      type: typeMap[components.type] || components.type,
      yearMonth: `20${components.yearMonth.substring(0, 2)}-${components.yearMonth.substring(2)}`,
      sequence: `#${components.sequence}`,
      component: components.component,
    };
  }
}

// Dual Immutability System (from spec)
export class DualImmutabilityService {
  constructor() {
    this.stage1Duration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    this.frozenItems = new Map();
  }

  /**
   * Stage 1: Off-chain freeze with DB snapshot
   */
  async freezeOffChain(chittyId, data, options = {}) {
    const freezeRecord = {
      chittyId,
      data,
      integrityHash: this.calculateIntegrityHash(data),
      frozenAt: new Date().toISOString(),
      eligibleForMintAt: new Date(
        Date.now() + this.stage1Duration,
      ).toISOString(),
      status: "FROZEN_OFFCHAIN",
      witnesses: options.witnesses || [],
      metadata: options.metadata || {},
    };

    this.frozenItems.set(chittyId, freezeRecord);

    return {
      success: true,
      freezeRecord,
      message: `Item frozen off-chain. Eligible for on-chain mint after ${new Date(freezeRecord.eligibleForMintAt).toLocaleString()}`,
    };
  }

  /**
   * Stage 2: On-chain mint after eligibility check
   */
  async mintOnChain(chittyId, options = {}) {
    const frozenRecord = this.frozenItems.get(chittyId);

    if (!frozenRecord) {
      throw new Error("ChittyID not found in frozen records");
    }

    if (frozenRecord.status !== "FROZEN_OFFCHAIN") {
      throw new Error(`Invalid status for minting: ${frozenRecord.status}`);
    }

    // Check eligibility (7 day minimum + other requirements)
    const now = new Date();
    const eligibleAt = new Date(frozenRecord.eligibleForMintAt);

    if (now < eligibleAt) {
      const remainingTime = Math.ceil((eligibleAt - now) / (1000 * 60 * 60)); // hours
      throw new Error(
        `Not eligible for minting yet. ${remainingTime} hours remaining.`,
      );
    }

    // Simulate on-chain minting
    const mintRecord = {
      ...frozenRecord,
      status: "MINTED_ONCHAIN",
      mintedAt: now.toISOString(),
      txHash: `0x${crypto.randomBytes(32).toString("hex")}`,
      blockNumber: Math.floor(Math.random() * 1000000) + 15000000,
      chainId: options.chainId || 1, // Ethereum mainnet
      gasUsed: Math.floor(Math.random() * 100000) + 21000,
    };

    this.frozenItems.set(chittyId, mintRecord);

    return {
      success: true,
      mintRecord,
      explorerUrl: `https://etherscan.io/tx/${mintRecord.txHash}`,
    };
  }

  /**
   * Calculate integrity hash for immutability verification
   */
  calculateIntegrityHash(data) {
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash("sha256").update(serialized).digest("hex");
  }

  /**
   * Verify immutability status
   */
  async verifyImmutability(chittyId) {
    const record = this.frozenItems.get(chittyId);

    if (!record) {
      return { status: "NOT_FOUND", immutable: false };
    }

    return {
      status: record.status,
      immutable: record.status === "MINTED_ONCHAIN",
      frozenAt: record.frozenAt,
      mintedAt: record.mintedAt,
      integrityHash: record.integrityHash,
      txHash: record.txHash,
      blockNumber: record.blockNumber,
    };
  }
}

// Claim Composition System (from spec)
export class ClaimCompositionService {
  constructor() {
    this.claims = new Map();
    this.evidenceWeights = {
      PRIMARY: 1.0,
      SUPPORTING: 0.7,
      CORROBORATING: 0.5,
      CONTRADICTING: -0.8,
    };
  }

  /**
   * Create composite claim from multiple evidence pieces
   */
  async createClaim(type, assertion, components = []) {
    const chittyIdCore = new ChittyIDCore();
    const claimId = chittyIdCore.generateChittyID({
      namespace: "CLM",
      type: "C",
    });

    const claim = {
      id: claimId.identifier,
      type,
      assertion,
      components: [],
      createdAt: new Date().toISOString(),
      status: "DRAFT",
      validityScore: 0,
    };

    // Add components if provided
    for (const component of components) {
      await this.addComponent(claimId.identifier, component);
    }

    this.claims.set(claimId.identifier, claim);
    return claim;
  }

  /**
   * Add evidence component to claim
   */
  async addComponent(claimId, component) {
    const claim = this.claims.get(claimId);
    if (!claim) {
      throw new Error("Claim not found");
    }

    const evidenceComponent = {
      chittyId: component.chittyId,
      role: component.role || "SUPPORTING",
      weight: component.weight || this.evidenceWeights[component.role] || 0.5,
      addedAt: new Date().toISOString(),
      metadata: component.metadata || {},
    };

    claim.components.push(evidenceComponent);
    claim.validityScore = this.calculateValidityScore(claim);
    claim.updatedAt = new Date().toISOString();

    this.claims.set(claimId, claim);
    return evidenceComponent;
  }

  /**
   * Calculate claim validity based on weighted evidence
   */
  calculateValidityScore(claim) {
    if (claim.components.length === 0) return 0;

    const totalWeight = claim.components.reduce(
      (sum, comp) => sum + comp.weight,
      0,
    );
    const normalizedScore = Math.max(
      0,
      Math.min(1, totalWeight / claim.components.length),
    );

    // Determine status based on score
    if (normalizedScore >= 0.8) {
      claim.status = "VALID";
    } else if (normalizedScore >= 0.5) {
      claim.status = "PARTIALLY_VALID";
    } else {
      claim.status = "DISPUTED";
    }

    return normalizedScore;
  }

  /**
   * Verify claim integrity and component validity
   */
  async verifyClaim(claimId) {
    const claim = this.claims.get(claimId);
    if (!claim) {
      throw new Error("Claim not found");
    }

    // Check each component's immutability status
    const dualImmutability = new DualImmutabilityService();
    const componentVerifications = [];

    for (const component of claim.components) {
      const verification = await dualImmutability.verifyImmutability(
        component.chittyId,
      );
      componentVerifications.push({
        chittyId: component.chittyId,
        role: component.role,
        weight: component.weight,
        immutable: verification.immutable,
        status: verification.status,
      });
    }

    return {
      claimId,
      valid: claim.status === "VALID",
      validityScore: claim.validityScore,
      status: claim.status,
      components: componentVerifications,
      verifiedAt: new Date().toISOString(),
    };
  }
}

export default ChittyIDCore;
