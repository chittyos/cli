# ChittyOS Cloudflare MCP Connector

Comprehensive infrastructure management for Cloudflare Workers, R2 Storage, D1 Database, and KV Storage - integrated with ChittyOS legal and case management systems.

## 🎯 Purpose

This MCP connector enables ChittyOS executives to directly manage Cloudflare infrastructure through AI-driven decisions, with built-in case tracking, audit trails, and compliance monitoring.

## ✨ Features

### 🔧 **Cloudflare Workers Management**
- Deploy Workers with ChittyOS case tracking
- List and manage existing Workers
- Automatic metadata injection for compliance
- Environment-specific deployments

### 🗂️ **R2 Object Storage**
- Create and manage R2 buckets
- Case-linked storage provisioning
- Audit trail for all storage operations

### 🗃️ **D1 Database Operations**
- Create and manage D1 databases
- Execute SQL queries with audit logging
- Case-specific database provisioning

### 📦 **KV Storage Management**
- Create and manage KV namespaces
- Key-value storage for application data

### 🛡️ **ChittyOS Integration**
- **Case Tracking**: Link all infrastructure to legal cases
- **Audit Trails**: Complete compliance logging
- **Metadata Injection**: Automatic ChittyOS metadata in all resources
- **Executive Integration**: Direct connection to ChittyOS decision systems

## 🚀 Quick Start

### 1. **Run Setup**
```bash
cd /Users/nb/.claude/tools/chittyos-cloudflare-mcp
./setup.sh
```

### 2. **Configure Credentials**
```bash
nano .env
```

Add your Cloudflare credentials:
```env
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_ZONE_ID=your_zone_id_here  # Optional
```

### 3. **Get Cloudflare Credentials**

**API Token:**
1. Go to [Cloudflare Dashboard > API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use "Custom token" template
4. Add permissions:
   - Account: `Cloudflare Tunnel:Edit`, `Account Settings:Read`
   - Zone: `Zone Settings:Edit`, `Zone:Read`
   - User: `User Details:Read`

**Account ID:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Copy Account ID from right sidebar

### 4. **Restart Claude Desktop**
The setup script automatically configures Claude Desktop. Just restart the application.

## 🛠️ Available Tools

### Workers Management
```
chitty_deploy_worker      - Deploy Worker with case tracking
chitty_list_workers       - List all Workers with metadata
chitty_get_worker         - Get Worker details
chitty_delete_worker      - Delete Worker with audit trail
```

### R2 Storage
```
chitty_create_r2_bucket   - Create R2 bucket with case tracking
chitty_list_r2_buckets    - List all R2 buckets with metadata
chitty_delete_r2_bucket   - Delete R2 bucket with audit trail
```

### D1 Database
```
chitty_create_d1_database - Create D1 database with case tracking
chitty_list_d1_databases  - List all D1 databases with metadata
chitty_query_d1_database  - Execute SQL with audit logging
chitty_delete_d1_database - Delete D1 database with audit trail
```

### KV Storage
```
chitty_create_kv_namespace - Create KV namespace with case tracking
chitty_list_kv_namespaces  - List all KV namespaces with metadata
```

## 💼 ChittyOS Integration Examples

### Deploy Legal Tech Worker
```python
# Deploy a contract analysis Worker linked to a case
await chitty_deploy_worker(
    script_name="contract-analyzer-v2",
    script_content=worker_code,
    case_id="CASE-2024-001",
    environment="production"
)
```

### Create Case-Specific Database
```python
# Create D1 database for document storage
await chitty_create_d1_database(
    database_name="client-documents-db",
    case_id="CASE-2024-001"
)
```

### Query with Audit Trail
```python
# Execute query with compliance logging
await chitty_query_d1_database(
    database_id="db-123",
    sql="SELECT * FROM contracts WHERE status = 'pending'",
    case_id="CASE-2024-001"
)
```

## 🔒 Security & Compliance

### **Environment Variables**
- All credentials stored in `.env` file
- Never hardcoded in source code
- Automatic environment isolation

### **Audit Logging**
- All operations logged with timestamps
- Case ID tracking for legal compliance
- ChittyOS metadata in all resources

### **Metadata Injection**
Every resource gets ChittyOS metadata:
```json
{
  "deployment_source": "ChittyOS_Executive_System",
  "managed_by": "chitty_infrastructure_ai",
  "compliance_tracking": true,
  "timestamp": "2024-01-15T10:30:00Z",
  "case_id": "CASE-2024-001"
}
```

## 🗂️ File Structure

```
chittyos-cloudflare-mcp/
├── server.py                      # Main MCP server
├── requirements.txt               # Python dependencies
├── .env.template                  # Environment template
├── setup.sh                      # Installation script
├── README.md                      # This file
└── examples.py                    # Usage examples
```

## 🔧 Development

### **Manual Testing**
```bash
# Activate environment
source venv/bin/activate

# Run server directly
python server.py

# Test API connection
python -c "
import asyncio
from server import cloudflare_chitty
async def test():
    workers = await cloudflare_chitty.list_workers()
    print(workers)
asyncio.run(test())
"
```

### **Debugging**
- Check logs in Claude Desktop console
- Verify environment variables in `.env`
- Test Cloudflare API directly with curl

### **Adding New Features**
1. Add new method to `CloudflareChittyMCP` class
2. Add corresponding tool in `handle_list_tools()`
3. Add handler in `handle_call_tool()`
4. Update documentation

## 🎯 ChittyOS Ecosystem Integration

This connector integrates with:
- **ChittyOS Cases**: All infrastructure linked to legal cases
- **ChittyOS Documents**: Document storage in R2 buckets
- **ChittyOS Chain**: Blockchain verification of deployments
- **ChittyOS Verify**: Infrastructure compliance verification
- **ChittyOS Trust**: Reputation scoring for deployments

## 📞 Support

For ChittyOS-specific issues:
- Check the ChittyOS documentation
- Review audit logs for compliance issues
- Verify case ID linking

For Cloudflare API issues:
- Check [Cloudflare API docs](https://developers.cloudflare.com/api/)
- Verify API token permissions
- Test API connectivity

## 🚀 Next Steps

1. **Enhanced Monitoring**: Add performance metrics
2. **Auto-scaling**: Intelligent resource provisioning
3. **Cost Optimization**: Usage-based recommendations
4. **Security Scanning**: Automated vulnerability detection

---

**Built for ChittyOS** - Empowering legal professionals with AI-driven infrastructure management.