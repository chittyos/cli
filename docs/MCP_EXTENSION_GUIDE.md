# ChittyOS MCP Extension User Guide

## Table of Contents
1. [Installation](#installation)
2. [Configuration](#configuration)
3. [Available Tools](#available-tools)
4. [Usage Examples](#usage-examples)
5. [Troubleshooting](#troubleshooting)
6. [API Reference](#api-reference)

## Installation

### Method 1: Claude Desktop GUI
1. Download the latest release from [GitHub Releases](https://github.com/chittyos/cli/releases/latest)
2. Open Claude Desktop
3. Navigate to **Extensions** → **Install Extension**
4. Select the downloaded `chittyos-mcp-extension.mcpb` file
5. Restart Claude Desktop when prompted

### Method 2: Command Line
```bash
# Download the extension
curl -L -o chittyos-mcp-extension.mcpb \
  https://github.com/chittyos/cli/releases/latest/download/chittyos-mcp-extension.mcpb

# Verify checksum
curl -L -o chittyos-mcp-extension.mcpb.sha256 \
  https://github.com/chittyos/cli/releases/latest/download/chittyos-mcp-extension.mcpb.sha256
sha256sum -c chittyos-mcp-extension.mcpb.sha256

# Install via Claude CLI (if available)
claude extension install chittyos-mcp-extension.mcpb
```

### Method 3: Docker
```bash
# Pull and run the Docker image
docker run -d \
  --name chittyos-mcp \
  -e CHITTY_ID_TOKEN=your_token_here \
  -p 3000:3000 \
  chittyos/mcp-extension:latest
```

## Configuration

### Required Settings

#### ChittyID Token
You must provide a valid ChittyID token for the extension to function:

1. Open Claude Desktop settings
2. Navigate to Extensions → ChittyOS Framework
3. Enter your ChittyID token in the secure field
4. Click Save

To obtain a ChittyID token:
- Visit [https://id.chitty.cc](https://id.chitty.cc)
- Create an account or sign in
- Generate an API token from your dashboard

### Optional Settings

#### Environment
- **Production** (default): Live ChittyID service
- **Staging**: Test environment
- **Development**: Local development mode

#### R2 Storage (Optional)
```json
{
  "endpoint": "https://r2.cloudflarestorage.com",
  "access_key": "your_access_key",
  "secret_key": "your_secret_key"
}
```

#### Neon Database (Optional)
```
postgresql://user:password@host:5432/database
```

## Available Tools

### 1. Generate ChittyID
Generate unique identifiers for any entity with customizable prefixes.

**Usage in Claude:**
```
Use the generate_chitty_id tool with prefix "CASE"
```

**Parameters:**
- `prefix` (optional): Entity prefix (default: "CHITTY")
  - Common prefixes: CASE, DOC, TXN, USER, CONTRACT

**Example Response:**
```
Generated ChittyID: CASE-20250928-A1B2C3D4
```

### 2. Create Legal Case
Create a new legal case with full audit trail and §36 compliance.

**Usage in Claude:**
```
Create a legal case for client "Acme Corp" titled "Patent Infringement Defense"
```

**Parameters:**
- `title` (required): Case title
- `client` (required): Client name
- `matter_type` (optional): Type of legal matter
- `jurisdiction` (optional): Legal jurisdiction

### 3. Analyze Document
Analyze legal documents for compliance, risk assessment, and insights.

**Usage in Claude:**
```
Analyze the document at /path/to/contract.pdf for compliance issues
```

**Parameters:**
- `document_path` (required): Path to document
- `analysis_type` (optional): compliance, risk, summary, or all

### 4. Process Payment
Process financial transactions with ChittyID tracking and audit trails.

**Usage in Claude:**
```
Process a payment of $5000 for client CHITTY-2025-ABC123
```

**Parameters:**
- `amount` (required): Payment amount
- `client_id` (required): Client ChittyID
- `currency` (optional): Currency code (default: USD)
- `description` (optional): Payment description

### 5. Compliance Check
Run §36 compliance validation on code or documents.

**Usage in Claude:**
```
Run a compliance check on /project/src directory
```

**Parameters:**
- `path` (required): Path to check
- `check_type` (optional): id, security, data, or all

### 6. Search Cases
Search legal cases with advanced filters and criteria.

**Usage in Claude:**
```
Search for active cases for client "Smith Industries"
```

**Parameters:**
- `query` (optional): Search query
- `filters` (optional): Filter object with status, client, date_range

### 7. Execute Workflow
Execute predefined legal workflows.

**Usage in Claude:**
```
Execute the intake workflow for new client onboarding
```

**Parameters:**
- `workflow` (required): intake, discovery, filing, or billing
- `context` (optional): Additional workflow context

## Usage Examples

### Example 1: Complete Client Intake
```
1. Generate a new ChittyID for the client
2. Create a legal case with the generated ID
3. Execute the intake workflow
4. Run compliance check on collected documents
```

### Example 2: Document Processing Pipeline
```
1. Analyze document for compliance
2. Generate ChittyID for document tracking
3. Process any associated payments
4. Update case records
```

### Example 3: Billing Workflow
```
1. Search for active cases
2. Execute billing workflow
3. Process payments with ChittyID tracking
4. Generate compliance reports
```

## Troubleshooting

### Common Issues

#### Extension Not Loading
1. Verify Claude Desktop is up to date
2. Check extension compatibility in manifest
3. Restart Claude Desktop
4. Reinstall the extension

#### ChittyID Token Errors
1. Verify token is correctly entered
2. Check token hasn't expired
3. Ensure network connectivity to id.chitty.cc
4. Generate a new token if needed

#### Tool Execution Failures
1. Check error messages in Claude's response
2. Verify required parameters are provided
3. Ensure file paths are absolute, not relative
4. Check file/directory permissions

### Debug Mode
Enable debug logging:
```bash
export CHITTYOS_DEBUG=true
claude --verbose
```

### Support Channels
- GitHub Issues: [chittyos/cli/issues](https://github.com/chittyos/cli/issues)
- Email: support@chitty.cc
- Documentation: [https://docs.chitty.cc](https://docs.chitty.cc)

## API Reference

### Tool Response Format
All tools return responses in the following format:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Tool execution result"
    }
  ]
}
```

### Error Handling
Errors are returned with appropriate MCP error codes:
- `InvalidParams`: Missing or invalid parameters
- `InternalError`: Server-side execution error
- `MethodNotFound`: Unknown tool name

### Rate Limits
- Default: 100 requests per minute
- Premium: 1000 requests per minute
- Enterprise: Unlimited

### Webhook Integration
Configure webhooks for tool events:
```json
{
  "webhook_url": "https://your-server.com/webhook",
  "events": ["case.created", "payment.processed", "document.analyzed"]
}
```

## Security Best Practices

1. **Never share your ChittyID token**
2. **Use environment-specific tokens** (dev/staging/prod)
3. **Enable audit logging** for compliance
4. **Regularly rotate tokens** (recommended: every 90 days)
5. **Restrict file system access** to necessary directories
6. **Use encrypted connections** for database access

## Version History

### v1.0.1 (Current)
- Initial release with 7 legal/business tools
- §36 compliance framework
- ChittyID service integration
- Docker containerization support

### Upcoming Features (v1.1.0)
- Email integration tools
- Calendar management
- Document generation
- Batch processing support
- Enhanced analytics

## License

MIT License - See [LICENSE](https://github.com/chittyos/cli/blob/main/LICENSE)

---

Generated by ChittyOS Framework v1.0.1