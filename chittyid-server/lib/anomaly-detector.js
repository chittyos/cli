/**
 * Behavioral Anomaly Detection for ChittyID Service
 * Implements the enhanced monitoring from elaborations
 */

import crypto from "crypto";

export class AnomalyDetector {
  constructor() {
    // In-memory tracking for patterns (production would use Redis)
    this.requestPatterns = new Map();
    this.contentHashFrequency = new Map();
    this.clientBehavior = new Map();

    // Thresholds
    this.thresholds = {
      duplicateContentHash: 5, // Max same content_hash in 60 seconds
      requestRateSpike: 10, // 10x normal rate
      invalidHashRatio: 0.2, // 20% invalid hashes
      timestampDrift: 120000, // 2 minutes max drift
      fallbackUsageRate: 0.1, // 10% fallback usage triggers alert
      reconciliationFailureRate: 0.05, // 5% failure rate
    };

    // Forensic log for post-incident analysis
    this.forensicLog = [];
  }

  /**
   * Detect replay attempt patterns
   */
  detectReplayPattern(apiKey, contentHash, timestamp, nonce) {
    const key = `${apiKey}:${contentHash}`;
    const now = Date.now();

    // Check for duplicate content hash requests
    if (this.contentHashFrequency.has(key)) {
      const requests = this.contentHashFrequency.get(key);
      const recentRequests = requests.filter((r) => now - r.timestamp < 60000);

      if (recentRequests.length >= this.thresholds.duplicateContentHash) {
        this.logAnomaly({
          type: "REPLAY_ATTEMPT",
          apiKey,
          contentHash,
          frequency: recentRequests.length,
          severity: "HIGH",
        });
        return true;
      }

      recentRequests.push({ timestamp: now, nonce });
      this.contentHashFrequency.set(key, recentRequests);
    } else {
      this.contentHashFrequency.set(key, [{ timestamp: now, nonce }]);
    }

    return false;
  }

  /**
   * Detect abnormal request rate patterns
   */
  detectRateAnomaly(apiKey) {
    const now = Date.now();
    const clientKey = `rate:${apiKey}`;

    if (!this.clientBehavior.has(clientKey)) {
      this.clientBehavior.set(clientKey, {
        requests: [],
        baselineRate: null,
        lastAlert: 0,
      });
    }

    const behavior = this.clientBehavior.get(clientKey);
    behavior.requests.push(now);

    // Keep only last 5 minutes of requests
    behavior.requests = behavior.requests.filter((t) => now - t < 300000);

    // Calculate current rate (requests per minute)
    const currentRate = behavior.requests.length / 5;

    // Establish baseline after 10 requests
    if (!behavior.baselineRate && behavior.requests.length > 10) {
      behavior.baselineRate = currentRate;
    }

    // Detect spike
    if (
      behavior.baselineRate &&
      currentRate > behavior.baselineRate * this.thresholds.requestRateSpike
    ) {
      if (now - behavior.lastAlert > 60000) {
        // Don't alert more than once per minute
        this.logAnomaly({
          type: "RATE_SPIKE",
          apiKey,
          currentRate,
          baselineRate: behavior.baselineRate,
          severity: "MEDIUM",
        });
        behavior.lastAlert = now;
        return true;
      }
    }

    return false;
  }

  /**
   * Validate timestamp consistency with drand round
   */
  validateDrandConsistency(timestamp, drandRound, drandTimestamp) {
    const expectedTimestamp = this.drandRoundToTimestamp(drandRound);
    const drift = Math.abs(timestamp - expectedTimestamp);

    if (drift > this.thresholds.timestampDrift) {
      this.logAnomaly({
        type: "TIMESTAMP_DRIFT",
        providedTimestamp: timestamp,
        expectedTimestamp,
        drandRound,
        drift,
        severity: "MEDIUM",
      });
      return false;
    }

    return true;
  }

  /**
   * Track fallback service usage patterns
   */
  trackFallbackUsage(apiKey) {
    const key = `fallback:${apiKey}`;
    const now = Date.now();

    if (!this.clientBehavior.has(key)) {
      this.clientBehavior.set(key, {
        totalRequests: 0,
        fallbackRequests: 0,
        lastCheck: now,
      });
    }

    const stats = this.clientBehavior.get(key);
    stats.fallbackRequests++;
    stats.totalRequests++;

    const fallbackRate = stats.fallbackRequests / stats.totalRequests;

    if (fallbackRate > this.thresholds.fallbackUsageRate) {
      this.logAnomaly({
        type: "HIGH_FALLBACK_USAGE",
        apiKey,
        rate: fallbackRate,
        total: stats.totalRequests,
        fallback: stats.fallbackRequests,
        severity: "LOW",
      });
    }
  }

  /**
   * Detect compromised client patterns
   */
  detectCompromisedClient(apiKey, requestData) {
    const indicators = [];

    // Check for malformed requests pattern
    if (requestData.invalidHashCount > 5) {
      indicators.push("EXCESSIVE_INVALID_HASHES");
    }

    // Check for outdated client version
    if (
      requestData.clientVersion &&
      this.isOutdatedVersion(requestData.clientVersion)
    ) {
      indicators.push("OUTDATED_CLIENT");
    }

    // Check for suspicious user agent
    if (this.isSuspiciousUserAgent(requestData.userAgent)) {
      indicators.push("SUSPICIOUS_USER_AGENT");
    }

    // Check for impossible timestamp (future dates)
    if (requestData.timestamp > Date.now() + 60000) {
      indicators.push("FUTURE_TIMESTAMP");
    }

    if (indicators.length > 0) {
      this.logAnomaly({
        type: "COMPROMISED_CLIENT_SUSPECTED",
        apiKey,
        indicators,
        severity: indicators.length > 2 ? "HIGH" : "MEDIUM",
      });
      return true;
    }

    return false;
  }

  /**
   * Runtime integrity check for client
   */
  validateClientIntegrity(apiKey, integrityHash, expectedHash) {
    if (integrityHash !== expectedHash) {
      this.logAnomaly({
        type: "CLIENT_INTEGRITY_FAILURE",
        apiKey,
        providedHash: integrityHash,
        expectedHash,
        severity: "CRITICAL",
      });
      return false;
    }
    return true;
  }

  /**
   * Log anomaly for forensic analysis
   */
  logAnomaly(anomaly) {
    const entry = {
      ...anomaly,
      timestamp: Date.now(),
      id: crypto.randomBytes(16).toString("hex"),
    };

    this.forensicLog.push(entry);

    // In production, also send to SIEM
    this.sendToSIEM(entry);

    // Trigger alerts based on severity
    if (anomaly.severity === "CRITICAL" || anomaly.severity === "HIGH") {
      this.triggerAlert(entry);
    }
  }

  /**
   * Get forensic report for analysis
   */
  getForensicReport(timeRange = 3600000) {
    const now = Date.now();
    const relevantLogs = this.forensicLog.filter(
      (log) => now - log.timestamp < timeRange,
    );

    // Group by type
    const byType = {};
    relevantLogs.forEach((log) => {
      if (!byType[log.type]) {
        byType[log.type] = [];
      }
      byType[log.type].push(log);
    });

    // Calculate statistics
    const stats = {
      totalAnomalies: relevantLogs.length,
      bySeverity: {
        CRITICAL: relevantLogs.filter((l) => l.severity === "CRITICAL").length,
        HIGH: relevantLogs.filter((l) => l.severity === "HIGH").length,
        MEDIUM: relevantLogs.filter((l) => l.severity === "MEDIUM").length,
        LOW: relevantLogs.filter((l) => l.severity === "LOW").length,
      },
      byType,
      timeRange: {
        start: new Date(now - timeRange).toISOString(),
        end: new Date(now).toISOString(),
      },
    };

    return {
      stats,
      logs: relevantLogs,
    };
  }

  /**
   * Helper: Convert drand round to expected timestamp
   */
  drandRoundToTimestamp(round) {
    // Drand mainnet genesis time and period
    const GENESIS_TIME = 1595431050000; // July 22, 2020, 10:10:50 PM UTC
    const PERIOD = 30000; // 30 seconds

    return GENESIS_TIME + round * PERIOD;
  }

  /**
   * Helper: Check if client version is outdated
   */
  isOutdatedVersion(version) {
    const MIN_VERSION = "2.0.0";
    // Simple version comparison (production would use semver)
    return version < MIN_VERSION;
  }

  /**
   * Helper: Detect suspicious user agents
   */
  isSuspiciousUserAgent(userAgent) {
    const suspiciousPatterns = [
      /curl/i,
      /wget/i,
      /python/i,
      /bot/i,
      /crawler/i,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }

  /**
   * Send to SIEM system (placeholder)
   */
  sendToSIEM(entry) {
    // In production: Send to CloudWatch, Datadog, etc.
    console.log("[SIEM]", JSON.stringify(entry));
  }

  /**
   * Trigger alert (placeholder)
   */
  triggerAlert(entry) {
    // In production: Send to PagerDuty, Slack, etc.
    console.error("[ALERT]", entry.type, entry.severity, entry);
  }

  /**
   * Clean up old data (run periodically)
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    // Clean request patterns
    for (const [key, value] of this.requestPatterns) {
      if (now - value.timestamp > maxAge) {
        this.requestPatterns.delete(key);
      }
    }

    // Clean content hash frequency
    for (const [key, requests] of this.contentHashFrequency) {
      const filtered = requests.filter((r) => now - r.timestamp < maxAge);
      if (filtered.length === 0) {
        this.contentHashFrequency.delete(key);
      } else {
        this.contentHashFrequency.set(key, filtered);
      }
    }

    // Trim forensic log
    this.forensicLog = this.forensicLog.filter(
      (log) => now - log.timestamp < 86400000, // Keep 24 hours
    );
  }
}

// Singleton instance
export const anomalyDetector = new AnomalyDetector();

// Run cleanup every 5 minutes
setInterval(() => {
  anomalyDetector.cleanup();
}, 300000);
