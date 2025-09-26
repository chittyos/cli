#!/usr/bin/env node

// ChittyOS Fallback System with Error-Coded IDs
// Generates temporary IDs that get reconciled upon reconnection

import { ChittyIDCore } from "./chittyid-core.js";

export class ChittyFallbackSystem {
  constructor() {
    this.chittyIdCore = new ChittyIDCore();
    this.pendingReconciliation = new Map();
    this.isConnected = false;
    this.errorCodes = {
      DISCONNECTED: "DIS",
      PENDING_SYNC: "PSY",
      LOCAL_ONLY: "LOC",
      AWAITING_MINT: "AWM",
      TEMP_ID: "TMP",
    };
  }

  /**
   * Generate fallback ChittyID with error code
   * Format: VV-E-XXX-SSSS-T-YM-C-X where E = Error domain
   */
  generateFallbackID(options = {}) {
    const errorCode = options.errorCode || this.errorCodes.DISCONNECTED;

    // Generate ID with Error domain 'E' to indicate fallback state
    const fallbackId = this.chittyIdCore.generateChittyID({
      namespace: errorCode, // Use error code as namespace
      type: options.type || "F", // F for Fallback
      domain: "E", // E for Error/Fallback domain (not C for ChittyCorp)
    });

    // Store for later reconciliation
    const fallbackRecord = {
      fallbackId: fallbackId.identifier,
      originalRequest: options,
      createdAt: new Date().toISOString(),
      status: "PENDING_RECONCILIATION",
      errorCode,
      willExpireAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      reconciliationData: {
        targetNamespace: options.targetNamespace || "MNT",
        targetType: options.targetType || "M",
        subject: options.subject,
        metadata: options.metadata || {},
      },
    };

    this.pendingReconciliation.set(fallbackId.identifier, fallbackRecord);

    return {
      ...fallbackId,
      isFallback: true,
      errorCode,
      reconciliationPending: true,
      message: `Temporary ID generated offline. Will be reconciled when connection restored.`,
      fallbackRecord,
    };
  }

  /**
   * Check if ID is a fallback ID
   */
  isFallbackID(chittyId) {
    // Fallback IDs have domain 'E' (Error) instead of 'C' (ChittyCorp)
    if (!chittyId || typeof chittyId !== "string") return false;

    const parts = chittyId.split("-");
    return parts.length >= 2 && parts[1] === "E";
  }

  /**
   * Get error code from fallback ID
   */
  getErrorCode(chittyId) {
    if (!this.isFallbackID(chittyId)) return null;

    const parts = chittyId.split("-");
    return parts[2]; // The namespace contains the error code
  }

  /**
   * Reconcile fallback IDs with real ChittyCorp IDs upon reconnection
   */
  async reconcileFallbackIDs(connectionApi) {
    const reconciliationReport = {
      startedAt: new Date().toISOString(),
      totalPending: this.pendingReconciliation.size,
      reconciled: [],
      failed: [],
      expired: [],
    };

    for (const [fallbackId, record] of this.pendingReconciliation) {
      try {
        // Check if expired
        if (new Date() > new Date(record.willExpireAt)) {
          reconciliationReport.expired.push({
            fallbackId,
            expiredAt: record.willExpireAt,
            originalRequest: record.originalRequest,
          });
          this.pendingReconciliation.delete(fallbackId);
          continue;
        }

        // Attempt to get real ChittyID from ChittyCorp
        const realId = await this.requestRealID(connectionApi, record);

        if (realId) {
          // Success - store mapping and update record
          const reconciliationEntry = {
            fallbackId,
            realId: realId.identifier,
            reconciledAt: new Date().toISOString(),
            originalRequest: record.originalRequest,
          };

          reconciliationReport.reconciled.push(reconciliationEntry);

          // Update the record
          record.status = "RECONCILED";
          record.realId = realId.identifier;
          record.reconciledAt = new Date().toISOString();

          // Emit reconciliation event (for UI updates, etc.)
          this.emitReconciliationEvent(fallbackId, realId.identifier);

          // Remove from pending after successful reconciliation
          this.pendingReconciliation.delete(fallbackId);
        } else {
          throw new Error("Failed to obtain real ID from ChittyCorp");
        }
      } catch (error) {
        reconciliationReport.failed.push({
          fallbackId,
          error: error.message,
          willRetry: true,
          retryAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // Retry in 1 hour
        });

        // Keep in pending for retry
        record.lastReconciliationAttempt = new Date().toISOString();
        record.reconciliationAttempts =
          (record.reconciliationAttempts || 0) + 1;
      }
    }

    reconciliationReport.completedAt = new Date().toISOString();
    reconciliationReport.successRate =
      (
        (reconciliationReport.reconciled.length /
          reconciliationReport.totalPending) *
        100
      ).toFixed(2) + "%";

    return reconciliationReport;
  }

  /**
   * Request real ID from ChittyCorp API
   */
  async requestRealID(connectionApi, fallbackRecord) {
    // This would make actual API call to ChittyCorp
    // For now, simulate the request
    const requestData = {
      fallbackId: fallbackRecord.fallbackId,
      reconciliationData: fallbackRecord.reconciliationData,
      createdAt: fallbackRecord.createdAt,
      errorCode: fallbackRecord.errorCode,
    };

    try {
      // In production, this would be:
      // const response = await connectionApi.post('/reconcile', requestData);
      // return response.data.realId;

      // Simulation for development
      const realId = this.chittyIdCore.generateChittyID({
        namespace: fallbackRecord.reconciliationData.targetNamespace,
        type: fallbackRecord.reconciliationData.targetType,
        domain: "C", // Real ChittyCorp domain
      });

      return realId;
    } catch (error) {
      console.error("Failed to request real ID:", error);
      throw error;
    }
  }

  /**
   * Emit reconciliation event for UI updates
   */
  emitReconciliationEvent(fallbackId, realId) {
    if (typeof process !== "undefined" && process.emit) {
      process.emit("chitty:reconciliation", {
        fallbackId,
        realId,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`✅ Reconciled: ${fallbackId} → ${realId}`);
  }

  /**
   * Get pending reconciliation status
   */
  getReconciliationStatus() {
    const pending = Array.from(this.pendingReconciliation.values());

    return {
      totalPending: pending.length,
      oldestPending: pending.reduce((oldest, record) => {
        return !oldest ||
          new Date(record.createdAt) < new Date(oldest.createdAt)
          ? record
          : oldest;
      }, null),
      byErrorCode: pending.reduce((acc, record) => {
        acc[record.errorCode] = (acc[record.errorCode] || 0) + 1;
        return acc;
      }, {}),
      expiringWithin24h: pending.filter((record) => {
        const hoursUntilExpiry =
          (new Date(record.willExpireAt) - new Date()) / (1000 * 60 * 60);
        return hoursUntilExpiry <= 24 && hoursUntilExpiry > 0;
      }).length,
    };
  }

  /**
   * Generate soft-mint with fallback support
   */
  async generateSoftMint(subject, options = {}) {
    try {
      // Try to connect to ChittyCorp
      if (await this.checkConnection()) {
        // Connected - generate real ID
        const realId = this.chittyIdCore.generateChittyID({
          namespace: "MNT",
          type: "S", // Soft mint
          domain: "C",
        });

        return {
          ...realId,
          isFallback: false,
          status: "CONNECTED",
        };
      }
    } catch (error) {
      console.warn("Connection failed, using fallback:", error.message);
    }

    // Not connected - generate fallback ID
    return this.generateFallbackID({
      errorCode: this.errorCodes.AWAITING_MINT,
      targetNamespace: "MNT",
      targetType: "S",
      type: "S",
      subject,
      metadata: {
        mintType: "soft",
        ...options,
      },
    });
  }

  /**
   * Check connection to ChittyCorp
   */
  async checkConnection() {
    try {
      // In production, this would ping the ChittyCorp worker
      // For now, simulate connection check
      const CHITTYCORP_WORKER_URL =
        "https://0bc21e3a5a9de1a4cc843be9c3e98121.chitty-unified.workers.dev/health";

      // Simulate random connection status for testing
      this.isConnected = Math.random() > 0.5;

      return this.isConnected;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Display fallback status in CLI
   */
  displayFallbackStatus() {
    const status = this.getReconciliationStatus();

    console.log("\n📊 Fallback System Status");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(
      `Connection: ${this.isConnected ? "✅ Connected" : "⚠️  Disconnected"}`,
    );
    console.log(`Pending Reconciliation: ${status.totalPending}`);

    if (status.totalPending > 0) {
      console.log(`\nBy Error Code:`);
      for (const [code, count] of Object.entries(status.byErrorCode)) {
        console.log(`  ${code}: ${count}`);
      }

      if (status.expiringWithin24h > 0) {
        console.log(
          `\n⚠️  ${status.expiringWithin24h} IDs expiring within 24 hours`,
        );
      }

      if (status.oldestPending) {
        const ageHours =
          (new Date() - new Date(status.oldestPending.createdAt)) /
          (1000 * 60 * 60);
        console.log(`\nOldest pending: ${ageHours.toFixed(1)} hours`);
        console.log(`  ID: ${status.oldestPending.fallbackId}`);
      }
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }
}

// Auto-reconciliation scheduler
export class ReconciliationScheduler {
  constructor(fallbackSystem) {
    this.fallbackSystem = fallbackSystem;
    this.intervalId = null;
    this.reconciliationHistory = [];
  }

  /**
   * Start auto-reconciliation
   */
  start(intervalMinutes = 5) {
    if (this.intervalId) {
      console.log("Reconciliation scheduler already running");
      return;
    }

    console.log(
      `🔄 Starting auto-reconciliation (every ${intervalMinutes} minutes)`,
    );

    this.intervalId = setInterval(
      async () => {
        console.log("🔄 Attempting reconciliation...");

        try {
          const report = await this.fallbackSystem.reconcileFallbackIDs();
          this.reconciliationHistory.push(report);

          if (report.reconciled.length > 0) {
            console.log(`✅ Reconciled ${report.reconciled.length} IDs`);
          }

          if (report.failed.length > 0) {
            console.log(
              `⚠️  Failed to reconcile ${report.failed.length} IDs (will retry)`,
            );
          }

          if (report.expired.length > 0) {
            console.log(`❌ ${report.expired.length} IDs expired`);
          }
        } catch (error) {
          console.error("Reconciliation error:", error);
        }
      },
      intervalMinutes * 60 * 1000,
    );
  }

  /**
   * Stop auto-reconciliation
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("🛑 Stopped auto-reconciliation");
    }
  }

  /**
   * Get reconciliation history
   */
  getHistory() {
    return this.reconciliationHistory;
  }
}

export default ChittyFallbackSystem;
