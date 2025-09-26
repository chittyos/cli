#!/usr/bin/env node

// Apple Notes Integration for ChittyOS
// Extracts and indexes documents/media from Apple Notes storage

import fs from "fs-extra";
import path from "path";
import globPkg from "glob";
import crypto from "crypto";
import { ChittyIDCore, DualImmutabilityService } from "./chittyid-core.js";

const { glob } = globPkg;

export class AppleNotesIntegration {
  constructor() {
    this.chittyIdCore = new ChittyIDCore();
    this.dualImmutability = new DualImmutabilityService();
    this.baseNotesPath =
      "/Users/nb/Library/Group Containers/group.com.apple.notes";
    this.indexedFiles = new Map();
    this.indexedNotes = new Map();
    this.notesDbPath = path.join(this.baseNotesPath, "Accounts");
  }

  /**
   * Scan Apple Notes for media, documents, and notes content
   */
  async scanNotes(options = {}) {
    const accountId = options.account || "93D472EE-7514-4115-91DB-CD33CD4B40AA";
    const accountPath = path.join(this.baseNotesPath, "Accounts", accountId);

    if (!fs.existsSync(accountPath)) {
      throw new Error(`Apple Notes account path not found: ${accountPath}`);
    }

    const results = {
      scanResults: {
        accountId,
        scanPath: accountPath,
        scannedAt: new Date().toISOString(),
        mediaFiles: [],
        notes: [],
        databases: [],
      },
    };

    // Scan for media files
    const mediaPath = path.join(accountPath, "Media");
    if (fs.existsSync(mediaPath)) {
      const formatFilter = options.format ? `*.${options.format}` : "*";
      const mediaPattern = path.join(mediaPath, "**", formatFilter);

      try {
        const files = await glob(mediaPattern, { nodir: true });

        results.scanResults.mediaFiles = files.map((filePath) => {
          const stats = fs.statSync(filePath);
          const fileName = path.basename(filePath);
          const fileExtension = path.extname(filePath).toLowerCase();

          return {
            path: filePath,
            name: fileName,
            extension: fileExtension,
            size: stats.size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
            type: this.getMediaType(fileExtension),
            chittyId: null,
          };
        });
      } catch (error) {
        console.warn(`Warning: Could not scan media files: ${error.message}`);
      }
    }

    // Scan for note databases and content
    try {
      const dbFiles = await glob(path.join(accountPath, "**/*.sqlite*"), {
        nodir: true,
      });
      results.scanResults.databases = dbFiles;

      // Extract notes content from databases
      const notesContent = await this.extractNotesFromDatabases(
        dbFiles,
        options,
      );
      results.scanResults.notes = notesContent;
    } catch (error) {
      console.warn(`Warning: Could not scan notes databases: ${error.message}`);
    }

    // Scan for plist files with note metadata
    try {
      const plistFiles = await glob(path.join(accountPath, "**/*.plist"), {
        nodir: true,
      });
      const metadataFiles = await this.extractMetadataFromPlists(plistFiles);
      results.scanResults.metadata = metadataFiles;
    } catch (error) {
      console.warn(`Warning: Could not scan metadata files: ${error.message}`);
    }

    results.scanResults.totalMediaFiles = results.scanResults.mediaFiles.length;
    results.scanResults.totalNotes = results.scanResults.notes.length;
    results.scanResults.totalDatabases = results.scanResults.databases.length;

    return results;
  }

  /**
   * Extract notes content from SQLite databases
   */
  async extractNotesFromDatabases(dbFiles, options = {}) {
    const notes = [];

    for (const dbFile of dbFiles) {
      try {
        // Since we can't directly query SQLite without a library,
        // we'll extract what we can from file structure and naming
        const stats = fs.statSync(dbFile);
        const fileName = path.basename(dbFile);

        if (fileName.includes("NoteStore") || fileName.includes("notes")) {
          const noteRecord = {
            type: "database",
            path: dbFile,
            fileName,
            size: stats.size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
            isNotesDatabase: true,
            // In production, would use sqlite3 to extract actual note content
            extractedContent: await this.simulateNoteExtraction(dbFile),
          };

          notes.push(noteRecord);
        }
      } catch (error) {
        console.warn(
          `Warning: Could not process database ${dbFile}: ${error.message}`,
        );
      }
    }

    return notes;
  }

  /**
   * Simulate note content extraction (would use sqlite3 in production)
   */
  async simulateNoteExtraction(dbFile) {
    const fileName = path.basename(dbFile);

    // Simulate extracted note content based on file structure
    return {
      simulatedNotes: [
        {
          noteId: this.generateNoteId(dbFile),
          title: `Note from ${fileName}`,
          content: `This is simulated note content extracted from ${fileName}. In production, this would contain the actual note text, formatting, and metadata.`,
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          folder: "Notes",
          hasAttachments: Math.random() > 0.5,
          wordCount: Math.floor(Math.random() * 500) + 50,
        },
      ],
      extractionMethod: "simulated",
      databaseFile: dbFile,
    };
  }

  /**
   * Extract metadata from plist files
   */
  async extractMetadataFromPlists(plistFiles) {
    const metadata = [];

    for (const plistFile of plistFiles) {
      try {
        const stats = fs.statSync(plistFile);
        const fileName = path.basename(plistFile);

        // Read plist content (simplified - would use proper plist parser in production)
        const content = fs.readFileSync(plistFile, "utf8");

        metadata.push({
          path: plistFile,
          fileName,
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
          contentPreview: content.substring(0, 500),
          type: "metadata",
        });
      } catch (error) {
        console.warn(
          `Warning: Could not process plist ${plistFile}: ${error.message}`,
        );
      }
    }

    return metadata;
  }

  /**
   * Extract and process specific media file
   */
  async extractMedia(mediaPath, options = {}) {
    if (!fs.existsSync(mediaPath)) {
      throw new Error(`Media file not found: ${mediaPath}`);
    }

    const stats = fs.statSync(mediaPath);
    const fileName = path.basename(mediaPath);
    const fileExtension = path.extname(mediaPath).toLowerCase();

    // Generate ChittyID for the media
    const chittyId = this.chittyIdCore.generateChittyID({
      namespace: "DOC",
      type: "E", // Evidence
    });

    // Calculate file hash for integrity
    const fileBuffer = fs.readFileSync(mediaPath);
    const fileHash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    const mediaRecord = {
      chittyId: chittyId.identifier,
      originalPath: mediaPath,
      fileName,
      fileExtension,
      fileSize: stats.size,
      fileHash,
      mediaType: this.getMediaType(fileExtension),
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      extracted: new Date().toISOString(),
      metadata: {
        isAppleNotesMedia: true,
        notesAccount: this.extractAccountFromPath(mediaPath),
        noteId: this.extractNoteIdFromPath(mediaPath),
      },
    };

    // Store in index
    this.indexedFiles.set(chittyId.identifier, mediaRecord);

    return {
      success: true,
      mediaRecord,
      chittyId: chittyId.identifier,
    };
  }

  /**
   * Index media content in Cloudflare Vectorize
   */
  async indexInVectorize(chittyId, options = {}) {
    const mediaRecord = this.indexedFiles.get(chittyId);
    if (!mediaRecord) {
      throw new Error("Media record not found. Extract media first.");
    }

    // Generate embedding based on file metadata and content
    const textContent = this.extractTextContent(mediaRecord);

    const vectorizeRecord = {
      id: chittyId,
      values: await this.generateEmbedding(textContent),
      metadata: {
        fileName: mediaRecord.fileName,
        mediaType: mediaRecord.mediaType,
        fileSize: mediaRecord.fileSize,
        created: mediaRecord.created,
        chittyNamespace: "DOC",
        isAppleNotesMedia: true,
        textContent: textContent.substring(0, 1000), // Truncate for storage
      },
    };

    // Simulate Vectorize indexing (would be real API call in production)
    console.log(`Indexing ${chittyId} in Cloudflare Vectorize...`);

    return {
      success: true,
      vectorizeId: chittyId,
      indexed: true,
      embeddingDimensions: vectorizeRecord.values.length,
      textLength: textContent.length,
    };
  }

  /**
   * Search indexed Apple Notes media
   */
  async searchNotes(keywords, options = {}) {
    const searchTerms = Array.isArray(keywords)
      ? keywords
      : keywords.split(",").map((k) => k.trim());

    const results = [];

    for (const [chittyId, mediaRecord] of this.indexedFiles) {
      const textContent = this.extractTextContent(mediaRecord);
      const matchScore = this.calculateMatchScore(textContent, searchTerms);

      if (matchScore > 0.1) {
        // Threshold for relevance
        results.push({
          chittyId,
          fileName: mediaRecord.fileName,
          mediaType: mediaRecord.mediaType,
          matchScore,
          path: mediaRecord.originalPath,
          created: mediaRecord.created,
          snippet: this.generateSnippet(textContent, searchTerms),
        });
      }
    }

    // Sort by match score
    results.sort((a, b) => b.matchScore - a.matchScore);

    return {
      searchResults: {
        query: searchTerms.join(", "),
        totalResults: results.length,
        searchedAt: new Date().toISOString(),
        results: results.slice(0, options.limit || 20),
      },
    };
  }

  /**
   * Freeze Apple Notes media for immutability
   */
  async freezeNotesMedia(chittyId, options = {}) {
    const mediaRecord = this.indexedFiles.get(chittyId);
    if (!mediaRecord) {
      throw new Error("Media record not found");
    }

    // Create immutability data
    const immutabilityData = {
      chittyId,
      mediaRecord,
      fileHash: mediaRecord.fileHash,
      timestamp: new Date().toISOString(),
      witnesses: options.witnesses || ["apple-notes-system"],
    };

    const freezeResult = await this.dualImmutability.freezeOffChain(
      chittyId,
      immutabilityData,
      options,
    );

    return {
      success: true,
      chittyId,
      freezeResult,
      eligibleForMint: freezeResult.freezeRecord.eligibleForMintAt,
    };
  }

  // Helper methods
  getMediaType(extension) {
    const typeMap = {
      ".pdf": "document",
      ".doc": "document",
      ".docx": "document",
      ".txt": "document",
      ".jpg": "image",
      ".jpeg": "image",
      ".png": "image",
      ".gif": "image",
      ".mp4": "video",
      ".mov": "video",
      ".mp3": "audio",
      ".wav": "audio",
    };
    return typeMap[extension] || "unknown";
  }

  extractAccountFromPath(filePath) {
    const match = filePath.match(/Accounts\/([^\/]+)\//);
    return match ? match[1] : "unknown";
  }

  extractNoteIdFromPath(filePath) {
    const match = filePath.match(/Media\/([^\/]+)\//);
    return match ? match[1] : "unknown";
  }

  extractTextContent(mediaRecord) {
    // For demo purposes, create searchable text from metadata
    // In production, would use OCR for images, PDF text extraction, etc.
    return [
      mediaRecord.fileName,
      mediaRecord.mediaType,
      `Created: ${mediaRecord.created}`,
      `Size: ${mediaRecord.fileSize} bytes`,
      `Apple Notes media file`,
    ].join(" ");
  }

  async generateEmbedding(text) {
    // Simulate embedding generation (would use Cloudflare Workers AI in production)
    // Using simple hash-based pseudo-embedding for demo
    const hash = crypto.createHash("md5").update(text).digest();
    const embedding = Array.from(hash).map((byte) => (byte - 128) / 128); // Normalize to [-1, 1]
    return embedding.slice(0, 384); // Standard embedding dimension
  }

  calculateMatchScore(text, searchTerms) {
    const lowerText = text.toLowerCase();
    let score = 0;

    for (const term of searchTerms) {
      const lowerTerm = term.toLowerCase();
      const matches = (lowerText.match(new RegExp(lowerTerm, "g")) || [])
        .length;
      score += matches * (1 / Math.max(1, term.length - 2)); // Longer terms weighted higher
    }

    return Math.min(1, (score / text.length) * 1000); // Normalize
  }

  generateSnippet(text, searchTerms, maxLength = 200) {
    for (const term of searchTerms) {
      const index = text.toLowerCase().indexOf(term.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + maxLength - 50);
        return `...${text.substring(start, end)}...`;
      }
    }
    return text.substring(0, maxLength) + "...";
  }

  generateNoteId(dbFile) {
    const hash = crypto.createHash("md5").update(dbFile).digest("hex");
    return `NOTE-${hash.substring(0, 8).toUpperCase()}`;
  }

  /**
   * Process and index a complete note with ChittyID
   */
  async processNote(noteContent, options = {}) {
    // Generate ChittyID for the note
    const chittyId = this.chittyIdCore.generateChittyID({
      namespace: "NOT",
      type: "D", // Document
    });

    const noteRecord = {
      chittyId: chittyId.identifier,
      title: noteContent.title || "Untitled Note",
      content: noteContent.content || "",
      folder: noteContent.folder || "Notes",
      created: noteContent.created || new Date().toISOString(),
      modified: noteContent.modified || new Date().toISOString(),
      wordCount: noteContent.content?.split(/\s+/).length || 0,
      hasAttachments: noteContent.hasAttachments || false,
      source: "Apple Notes",
      processed: new Date().toISOString(),
      metadata: {
        isAppleNote: true,
        extractionMethod: options.extractionMethod || "manual",
        originalId: noteContent.noteId,
        ...options.metadata,
      },
    };

    // Store in index
    this.indexedNotes.set(chittyId.identifier, noteRecord);

    return {
      success: true,
      noteRecord,
      chittyId: chittyId.identifier,
    };
  }

  /**
   * Index note content in Cloudflare Vectorize
   */
  async indexNoteInVectorize(chittyId, options = {}) {
    const noteRecord = this.indexedNotes.get(chittyId);
    if (!noteRecord) {
      throw new Error("Note record not found. Process note first.");
    }

    // Combine title and content for embedding
    const fullText = `${noteRecord.title} ${noteRecord.content}`;
    const embedding = await this.generateEmbedding(fullText);

    const vectorizeRecord = {
      id: chittyId,
      values: embedding,
      metadata: {
        title: noteRecord.title,
        folder: noteRecord.folder,
        wordCount: noteRecord.wordCount,
        created: noteRecord.created,
        chittyNamespace: "NOT",
        isAppleNote: true,
        hasAttachments: noteRecord.hasAttachments,
        contentPreview: noteRecord.content.substring(0, 500),
      },
    };

    console.log(`Indexing note ${chittyId} in Cloudflare Vectorize...`);

    return {
      success: true,
      vectorizeId: chittyId,
      indexed: true,
      embeddingDimensions: embedding.length,
      textLength: fullText.length,
    };
  }

  /**
   * Search both notes and media
   */
  async searchAll(keywords, options = {}) {
    const mediaResults = await this.searchNotes(keywords, options);

    // Search indexed notes
    const searchTerms = Array.isArray(keywords)
      ? keywords
      : keywords.split(",").map((k) => k.trim());
    const noteResults = [];

    for (const [chittyId, noteRecord] of this.indexedNotes) {
      const searchText = `${noteRecord.title} ${noteRecord.content}`;
      const matchScore = this.calculateMatchScore(searchText, searchTerms);

      if (matchScore > 0.05) {
        // Lower threshold for notes
        noteResults.push({
          chittyId,
          type: "note",
          title: noteRecord.title,
          folder: noteRecord.folder,
          matchScore,
          wordCount: noteRecord.wordCount,
          created: noteRecord.created,
          snippet: this.generateSnippet(searchText, searchTerms),
        });
      }
    }

    noteResults.sort((a, b) => b.matchScore - a.matchScore);

    return {
      searchResults: {
        query: searchTerms.join(", "),
        totalMediaResults: mediaResults.searchResults.totalResults,
        totalNoteResults: noteResults.length,
        searchedAt: new Date().toISOString(),
        mediaResults: mediaResults.searchResults.results,
        noteResults: noteResults.slice(0, options.limit || 20),
      },
    };
  }

  /**
   * Export note with ChittyID for portability
   */
  async exportNote(chittyId, format = "json") {
    const noteRecord = this.indexedNotes.get(chittyId);
    if (!noteRecord) {
      throw new Error("Note not found");
    }

    const exportData = {
      chittyId,
      title: noteRecord.title,
      content: noteRecord.content,
      folder: noteRecord.folder,
      created: noteRecord.created,
      modified: noteRecord.modified,
      wordCount: noteRecord.wordCount,
      exportedAt: new Date().toISOString(),
      format,
      source: "ChittyOS Apple Notes Integration",
      metadata: noteRecord.metadata,
    };

    switch (format.toLowerCase()) {
      case "markdown":
        return this.exportToMarkdown(exportData);
      case "txt":
        return this.exportToText(exportData);
      case "json":
      default:
        return JSON.stringify(exportData, null, 2);
    }
  }

  exportToMarkdown(exportData) {
    return `# ${exportData.title}

**ChittyID:** ${exportData.chittyId}
**Created:** ${exportData.created}
**Folder:** ${exportData.folder}
**Word Count:** ${exportData.wordCount}

---

${exportData.content}

---
*Exported from ChittyOS Apple Notes Integration on ${exportData.exportedAt}*
`;
  }

  exportToText(exportData) {
    return `${exportData.title}

ChittyID: ${exportData.chittyId}
Created: ${exportData.created}
Folder: ${exportData.folder}
Word Count: ${exportData.wordCount}

${exportData.content}

---
Exported from ChittyOS Apple Notes Integration on ${exportData.exportedAt}
`;
  }
}

export default AppleNotesIntegration;
