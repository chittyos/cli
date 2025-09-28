# ChittyOS MCP Desktop Extension

Enterprise-grade legal and business infrastructure with §36 compliance, ChittyID generation, and comprehensive MCP tools for Claude Desktop.

## Installation

### Method 1: Install from .mcpb Package

1. Download the `chittyos-mcp-extension.mcpb` file
2. Open Claude Desktop
3. Go to Extensions → Install Extension
4. Select the .mcpb file
5. Configure your ChittyID token when prompted

### Method 2: Manual Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Add to Claude Desktop configuration manually

## Configuration

The extension requires the following configuration:

- **ChittyID Token** (required): Your ChittyID service authentication token
- **Environment**: Production, Staging, or Development
- **R2 Storage** (optional): Cloudflare R2 credentials
- **Neon Database** (optional): PostgreSQL connection string

## Available Tools

### 1. Generate ChittyID
Generate unique ChittyIDs for any entity with customizable prefixes.

### 2. Create Legal Case
Create new legal cases with full audit trail and §36 compliance.

### 3. Analyze Document
Analyze legal documents for compliance, risk assessment, and insights.

### 4. Process Payment
Process financial transactions with ChittyID tracking and audit trails.

### 5. Compliance Check
Run §36 compliance validation on code or documents.

### 6. Search Cases
Search legal cases with advanced filters and criteria.

### 7. Execute Workflow
Execute predefined legal workflows (intake, discovery, filing, billing).

## Prompts

The extension includes pre-defined prompts for common tasks:

- **Legal Intake**: Start a new client intake process
- **Compliance Audit**: Run comprehensive §36 compliance audits
- **Document Analysis**: Analyze legal documents with customizable criteria

## Requirements

- Node.js >= 18.0.0
- Claude Desktop (latest version)
- ChittyID service token

## Development

To modify or extend the extension:

```bash
# Install dependencies
npm install

# Run in development mode
npm start

# Run tests
npm test

# Build new package
npm run build
```

## License

MIT License - ChittyOS Team

## Support

For support or issues, contact support@chitty.cc or visit https://chitty.cc