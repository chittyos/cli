#!/usr/bin/env node

// ChittyLedger - Immutable ledger with ChittyID appendages for subcategories
// Supports the 5 main categories with unlimited subcategories via appendages

import { ChittyIDCore } from "./chittyid-core.js";
import crypto from "crypto";

export class ChittyLedger {
  constructor() {
    this.chittyIdCore = new ChittyIDCore();
    this.ledger = new Map();
    this.appendageIndex = new Map(); // Maps ChittyID to its appendages

    // Main 5 categories with their subcategory structures
    this.mainCategories = {
      ASSET: {
        code: "AST",
        subcategories: {
          DIGITAL: "DIG",
          PHYSICAL: "PHY",
          INTELLECTUAL: "INT",
          FINANCIAL: "FIN",
          REAL_ESTATE: "RES",
        },
      },
      LIABILITY: {
        code: "LIA",
        subcategories: {
          DEBT: "DBT",
          OBLIGATION: "OBL",
          WARRANTY: "WAR",
          CONTINGENT: "CON",
          REGULATORY: "REG",
        },
      },
      TRANSACTION: {
        code: "TXN",
        subcategories: {
          PAYMENT: "PAY",
          TRANSFER: "TRF",
          EXCHANGE: "EXC",
          SETTLEMENT: "SET",
          REFUND: "REF",
        },
      },
      IDENTITY: {
        code: "IDN",
        subcategories: {
          PERSON: "PER",
          ORGANIZATION: "ORG",
          DEVICE: "DEV",
          SERVICE: "SVC",
          ROLE: "ROL",
        },
      },
      CONTRACT: {
        code: "CTR",
        subcategories: {
          AGREEMENT: "AGR",
          LICENSE: "LIC",
          TERMS: "TRM",
          SLA: "SLA",
          NDA: "NDA",
        },
      },
    };
  }

  /**
   * Create a ledger entry with ChittyID and appendages
   */
  async createEntry(category, subcategory, data, options = {}) {
    // Validate category
    const mainCategory = this.mainCategories[category];
    if (!mainCategory) {
      throw new Error(
        `Invalid category: ${category}. Must be one of: ${Object.keys(this.mainCategories).join(", ")}`,
      );
    }

    // Generate main ChittyID for the ledger entry
    const mainChittyId = await this.chittyIdCore.generateChittyID({
      namespace: mainCategory.code,
      type: "L", // L for Ledger
      domain: "C",
    });

    // Create appendages for subcategories and additional metadata
    const appendages = await this.generateAppendages(mainChittyId.identifier, {
      category,
      subcategory,
      data,
      ...options,
    });

    // Create the full ledger entry
    const ledgerEntry = {
      chittyId: mainChittyId.identifier,
      appendages,
      category,
      subcategory,
      data,
      hash: this.calculateEntryHash(data),
      timestamp: new Date().toISOString(),
      status: "ACTIVE",
      version: 1,
      metadata: options.metadata || {},
    };

    // Store in ledger
    this.ledger.set(mainChittyId.identifier, ledgerEntry);
    this.appendageIndex.set(mainChittyId.identifier, appendages);

    // Create immutable snapshot
    const snapshot = await this.createSnapshot(ledgerEntry);

    return {
      entry: ledgerEntry,
      snapshot,
      appendageCount: appendages.length,
    };
  }

  /**
   * Generate appendages for subcategories and additional data
   * Format: {MainChittyID}:{AppendageType}:{SubID}
   */
  async generateAppendages(mainChittyId, context) {
    const appendages = [];

    // 1. Subcategory appendage
    if (context.subcategory) {
      const subcatCode =
        this.mainCategories[context.category].subcategories[
          context.subcategory
        ];
      if (subcatCode) {
        const subcatAppendage = await this.createAppendage(
          mainChittyId,
          "SUBCAT",
          {
            code: subcatCode,
            name: context.subcategory,
            parentCategory: context.category,
          },
        );
        appendages.push(subcatAppendage);
      }
    }

    // 2. Data hash appendage (for integrity)
    if (context.data) {
      const hashAppendage = await this.createAppendage(mainChittyId, "HASH", {
        algorithm: "sha256",
        value: this.calculateEntryHash(context.data),
        dataSize: JSON.stringify(context.data).length,
      });
      appendages.push(hashAppendage);
    }

    // 3. Relationship appendages (links to other ChittyIDs)
    if (context.relationships) {
      for (const rel of context.relationships) {
        const relAppendage = await this.createAppendage(mainChittyId, "REL", {
          targetId: rel.targetId,
          type: rel.type,
          bidirectional: rel.bidirectional || false,
        });
        appendages.push(relAppendage);
      }
    }

    // 4. Witness appendages (for consensus)
    if (context.witnesses) {
      for (const witness of context.witnesses) {
        const witnessAppendage = await this.createAppendage(
          mainChittyId,
          "WIT",
          {
            witnessId: witness.id,
            signature: witness.signature,
            timestamp: witness.timestamp || new Date().toISOString(),
          },
        );
        appendages.push(witnessAppendage);
      }
    }

    // 5. Timeline appendages (for temporal tracking)
    if (context.timeline) {
      const timelineAppendage = await this.createAppendage(
        mainChittyId,
        "TIME",
        {
          created: context.timeline.created || new Date().toISOString(),
          effective: context.timeline.effective,
          expires: context.timeline.expires,
          duration: context.timeline.duration,
        },
      );
      appendages.push(timelineAppendage);
    }

    // 6. Classification appendages (for additional categorization)
    if (context.tags) {
      const classificationAppendage = await this.createAppendage(
        mainChittyId,
        "CLASS",
        {
          tags: context.tags,
          taxonomy: context.taxonomy || "default",
          confidence: context.confidence || 1.0,
        },
      );
      appendages.push(classificationAppendage);
    }

    // 7. Compliance appendages (for regulatory tracking)
    if (context.compliance) {
      const complianceAppendage = await this.createAppendage(
        mainChittyId,
        "COMP",
        {
          framework: context.compliance.framework,
          requirements: context.compliance.requirements,
          status: context.compliance.status || "pending",
          certifiedBy: context.compliance.certifiedBy,
        },
      );
      appendages.push(complianceAppendage);
    }

    return appendages;
  }

  /**
   * Create a single appendage
   */
  async createAppendage(mainChittyId, type, data) {
    // Generate sub-ChittyID for the appendage
    const appendageId = await this.chittyIdCore.generateChittyID({
      namespace: "APP", // Appendage namespace
      type: type.charAt(0), // First letter of appendage type
      domain: "C",
    });

    return {
      id: `${mainChittyId}:${type}:${appendageId.identifier}`,
      mainId: mainChittyId,
      appendageId: appendageId.identifier,
      type,
      data,
      hash: crypto
        .createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex"),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Query ledger by appendage properties
   */
  queryByAppendage(appendageType, filter) {
    const results = [];

    for (const [chittyId, appendages] of this.appendageIndex) {
      const matchingAppendages = appendages.filter((app) => {
        if (app.type !== appendageType) return false;

        // Apply filter function
        if (typeof filter === "function") {
          return filter(app.data);
        }

        // Apply object filter
        if (typeof filter === "object") {
          return Object.entries(filter).every(([key, value]) => {
            return app.data[key] === value;
          });
        }

        return true;
      });

      if (matchingAppendages.length > 0) {
        const entry = this.ledger.get(chittyId);
        results.push({
          entry,
          matchingAppendages,
        });
      }
    }

    return results;
  }

  /**
   * Get all entries in a subcategory
   */
  getBySubcategory(category, subcategory) {
    return this.queryByAppendage("SUBCAT", {
      name: subcategory,
      parentCategory: category,
    });
  }

  /**
   * Get entry with all appendages
   */
  getEntryWithAppendages(chittyId) {
    const entry = this.ledger.get(chittyId);
    if (!entry) return null;

    const appendages = this.appendageIndex.get(chittyId) || [];

    return {
      ...entry,
      appendages,
      appendagesByType: this.groupAppendagesByType(appendages),
    };
  }

  /**
   * Group appendages by type for easier access
   */
  groupAppendagesByType(appendages) {
    const grouped = {};

    for (const appendage of appendages) {
      if (!grouped[appendage.type]) {
        grouped[appendage.type] = [];
      }
      grouped[appendage.type].push(appendage);
    }

    return grouped;
  }

  /**
   * Create relationship between two ledger entries
   */
  async createRelationship(sourceId, targetId, relationshipType) {
    const sourceEntry = this.ledger.get(sourceId);
    const targetEntry = this.ledger.get(targetId);

    if (!sourceEntry || !targetEntry) {
      throw new Error("Both source and target entries must exist");
    }

    // Add relationship appendage to source
    const relAppendage = await this.createAppendage(sourceId, "REL", {
      targetId,
      type: relationshipType,
      bidirectional: true,
      createdAt: new Date().toISOString(),
    });

    // Add to source's appendages
    const sourceAppendages = this.appendageIndex.get(sourceId) || [];
    sourceAppendages.push(relAppendage);
    this.appendageIndex.set(sourceId, sourceAppendages);

    // Add reverse relationship to target
    const reverseAppendage = await this.createAppendage(targetId, "REL", {
      targetId: sourceId,
      type: `reverse_${relationshipType}`,
      bidirectional: true,
      createdAt: new Date().toISOString(),
    });

    const targetAppendages = this.appendageIndex.get(targetId) || [];
    targetAppendages.push(reverseAppendage);
    this.appendageIndex.set(targetId, targetAppendages);

    return {
      forward: relAppendage,
      reverse: reverseAppendage,
    };
  }

  /**
   * Calculate entry hash for integrity
   */
  calculateEntryHash(data) {
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash("sha256").update(serialized).digest("hex");
  }

  /**
   * Create immutable snapshot of ledger entry
   */
  async createSnapshot(entry) {
    const snapshot = {
      chittyId: entry.chittyId,
      hash: this.calculateEntryHash(entry),
      timestamp: new Date().toISOString(),
      blockHeight: this.ledger.size,
      previousHash: this.getLastSnapshotHash(),
    };

    // Calculate merkle root if multiple appendages
    if (entry.appendages && entry.appendages.length > 0) {
      snapshot.appendageMerkleRoot = this.calculateMerkleRoot(
        entry.appendages.map((a) => a.hash),
      );
    }

    return snapshot;
  }

  /**
   * Calculate merkle root for appendages
   */
  calculateMerkleRoot(hashes) {
    if (hashes.length === 0) return null;
    if (hashes.length === 1) return hashes[0];

    const pairs = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = hashes[i + 1] || hashes[i]; // Duplicate if odd number

      const combined = crypto
        .createHash("sha256")
        .update(left + right)
        .digest("hex");

      pairs.push(combined);
    }

    return this.calculateMerkleRoot(pairs);
  }

  /**
   * Get last snapshot hash for chaining
   */
  getLastSnapshotHash() {
    if (this.ledger.size === 0) return "0".repeat(64);

    const entries = Array.from(this.ledger.values());
    const lastEntry = entries[entries.length - 1];

    return this.calculateEntryHash(lastEntry);
  }

  /**
   * Export ledger with appendages
   */
  exportLedger(format = "full") {
    const entries = [];

    for (const [chittyId, entry] of this.ledger) {
      const appendages = this.appendageIndex.get(chittyId) || [];

      if (format === "full") {
        entries.push({
          ...entry,
          appendages,
          appendagesByType: this.groupAppendagesByType(appendages),
        });
      } else if (format === "compact") {
        entries.push({
          chittyId,
          category: entry.category,
          subcategory: entry.subcategory,
          appendageCount: appendages.length,
          timestamp: entry.timestamp,
        });
      }
    }

    return {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      format,
      entryCount: entries.length,
      totalAppendages: Array.from(this.appendageIndex.values()).reduce(
        (sum, apps) => sum + apps.length,
        0,
      ),
      entries,
    };
  }

  /**
   * Get statistics about ledger usage
   */
  getStatistics() {
    const stats = {
      totalEntries: this.ledger.size,
      totalAppendages: 0,
      byCategory: {},
      bySubcategory: {},
      appendageTypes: {},
    };

    for (const [chittyId, entry] of this.ledger) {
      // Count by category
      stats.byCategory[entry.category] =
        (stats.byCategory[entry.category] || 0) + 1;

      // Count by subcategory
      if (entry.subcategory) {
        const subKey = `${entry.category}:${entry.subcategory}`;
        stats.bySubcategory[subKey] = (stats.bySubcategory[subKey] || 0) + 1;
      }

      // Count appendages
      const appendages = this.appendageIndex.get(chittyId) || [];
      stats.totalAppendages += appendages.length;

      // Count appendage types
      for (const app of appendages) {
        stats.appendageTypes[app.type] =
          (stats.appendageTypes[app.type] || 0) + 1;
      }
    }

    return stats;
  }
}

export default ChittyLedger;
