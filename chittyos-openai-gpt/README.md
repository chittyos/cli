# ChittyOS OpenAI MCP Integration

🏛️ Native MCP connection to ChittyOS infrastructure using OpenAI's Responses API

## Features

- 🔌 **Native MCP Protocol** - Direct integration with OpenAI's Responses API
- 🌐 **Remote MCP Server** - Connects to ChittyMCP at mcp.chitty.cc
- 🚀 **No Custom GPT Required** - Uses OpenAI's built-in MCP support
- 🔒 **Secure Authentication** - Bearer token authentication via ChittyAPI
- 📊 **Full Tool Access** - Complete ChittyOS service catalog
- ⛓️ **Blockchain Integration** - Native ChittyChain and ChittyID support

## Database Integration

This API integrates with the existing ChittyOS Neon database schema:

- **event_store** - Complete audit trail
- **people** - Entity management
- **matters** - Legal case tracking
- **documents** - Document storage and analysis
- **transactions** - Financial operations
- **schema_versions** - Database versioning

## Quick Start

### 1. Prerequisites

- Python 3.9+
- Neon database account
- Vercel account (free tier works)
- OpenAI ChatGPT Plus (for Custom GPTs)

### 2. Setup

```bash
# Clone the repository
cd /Users/nb/.claude/tools/chittyos-openai-gpt

# Install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Configure Environment

Create `.env` file:

```env
# Required
NEON_DATABASE_URL=postgresql://user:pass@host.neon.tech/database?sslmode=require
CHITTY_API_KEY=your-secure-api-key-here

# Optional ChittyOS Services
CHITTY_CASE_DB_URL=https://cases.chitty.cc/api
CHITTY_CHAIN_RPC=https://chain.chitty.cc/rpc
CHITTY_VERIFY_ENDPOINT=https://verify.chitty.cc/api
CHITTY_TRUST_API=https://trust.chitty.cc/api
```

### 4. Deploy to Vercel

```bash
# One-command deployment
./deploy.sh

# Or manual deployment
vercel --prod
```

### 5. Create Custom GPT

1. Go to [ChatGPT GPTs Editor](https://chat.openai.com/gpts/editor)
2. Create new GPT
3. Import OpenAPI spec from: `https://your-app.vercel.app/openapi.json`
4. Configure authentication:
   - Type: API Key
   - Header: `Authorization`
   - Value: `Bearer YOUR_CHITTY_API_KEY`
5. Use instructions from `custom_gpt_instructions.md`
6. Test and publish!

## API Endpoints

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with database status |
| `/schema/info` | GET | Database schema information |
| `/legal/cases` | POST | Create legal case |
| `/documents/analyze` | POST | Analyze legal document |
| `/transactions` | POST | Create financial transaction |
| `/deployments` | POST | Record infrastructure deployment |

### Example Requests

#### Create Legal Case

```bash
curl -X POST https://your-app.vercel.app/legal/cases \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Acme Corp",
    "case_type": "CONTRACT",
    "jurisdiction": "US",
    "priority": "high",
    "auto_provision": true
  }'
```

#### Analyze Document

```bash
curl -X POST https://your-app.vercel.app/documents/analyze \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "document=@contract.pdf" \
  -F "case_id=CASE-2024-ACME" \
  -F "analysis_type=contract_review"
```

## Database Schema

The API uses the existing ChittyOS production schema:

```sql
-- Core tables used by this API
CREATE TABLE event_store (...)  -- Audit trail
CREATE TABLE people (...)       -- Entities
CREATE TABLE matters (...)      -- Legal cases
CREATE TABLE documents (...)    -- Document management
CREATE TABLE transactions (...)  -- Financial operations
```

Full schema available at: `/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittyschema/db/production-schema.sql`

## Development

### Local Testing

```bash
# Start local server
python3 api/main.py

# Test endpoints
curl http://localhost:8000/health
curl http://localhost:8000/schema/info -H "Authorization: Bearer YOUR_API_KEY"
```

### Database Migrations

```bash
# Connect to Neon
psql $NEON_DATABASE_URL

# Check schema version
SELECT * FROM schema_versions ORDER BY applied_at DESC;
```

## Architecture

```
ChatGPT (Custom GPT)
        ↓
    Vercel API
        ↓
  Neon Database
        ↓
ChittyOS Schema
```

## Security

- 🔒 API key authentication required
- 🌐 CORS configured for chat.openai.com
- 📝 All operations logged to event_store
- 🔐 Database credentials in environment variables
- ⛓️ Prepared for blockchain anchoring

## Monitoring

- Vercel Dashboard: Analytics and logs
- Database: Query event_store for audit trail
- Health endpoint: Monitor API and database status

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql $NEON_DATABASE_URL -c "SELECT version();"

# Check tables
psql $NEON_DATABASE_URL -c "\dt"
```

### Vercel Deployment Issues

```bash
# Check logs
vercel logs

# Redeploy
vercel --force
```

### Custom GPT Issues

1. Verify API is accessible: `curl https://your-app.vercel.app/health`
2. Check authentication header format
3. Test with Postman/Insomnia first
4. Review ChatGPT action logs

## Support

- Documentation: https://docs.chitty.cc/chatgpt
- Issues: https://github.com/chittyos/chatgpt-integration
- Support: support@chitty.cc

---

**ChittyOS: Empowering Legal Professionals with AI Infrastructure**

*"We're not replacing lawyers - we're creating informed clients"*