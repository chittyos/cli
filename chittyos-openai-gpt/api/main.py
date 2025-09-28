#!/usr/bin/env python3
"""
ChittyOS ChatGPT Integration API for Vercel
Integrates with existing Neon database schema
"""

import os
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from enum import Enum

import httpx
import asyncpg
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chittyos-vercel")

# FastAPI app
app = FastAPI(
    title="ChittyOS Infrastructure API",
    description="AI-driven legal tech infrastructure with Neon database integration",
    version="2.0.0",
    servers=[
        {"url": "https://chittyos-api.vercel.app", "description": "Production"},
        {"url": "http://localhost:8000", "description": "Development"}
    ]
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://chat.chitty.cc", "https://claude.ai"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    expected_token = os.getenv("CHITTY_API_KEY")
    if not expected_token or token != expected_token:
        raise HTTPException(status_code=403, detail="Invalid authentication")
    return token

# ============= DATABASE CONNECTION =============

class NeonDatabase:
    """Neon PostgreSQL database connection manager"""
    
    def __init__(self):
        self.database_url = os.getenv("NEON_DATABASE_URL") or os.getenv("DATABASE_URL")
        if not self.database_url:
            logger.error("No database URL configured")
        self.pool = None
    
    async def connect(self):
        """Create connection pool"""
        if not self.pool and self.database_url:
            try:
                self.pool = await asyncpg.create_pool(
                    self.database_url,
                    min_size=1,
                    max_size=10,
                    command_timeout=60
                )
                logger.info("Connected to Neon database")
            except Exception as e:
                logger.error(f"Database connection failed: {e}")
                self.pool = None
    
    async def disconnect(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
            self.pool = None
    
    async def execute(self, query: str, *args):
        """Execute a query"""
        if not self.pool:
            await self.connect()
        
        if not self.pool:
            raise HTTPException(status_code=500, detail="Database unavailable")
        
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)
    
    async def fetch(self, query: str, *args):
        """Fetch results"""
        if not self.pool:
            await self.connect()
        
        if not self.pool:
            raise HTTPException(status_code=500, detail="Database unavailable")
        
        async with self.pool.acquire() as conn:
            return await conn.fetch(query, *args)
    
    async def fetchrow(self, query: str, *args):
        """Fetch single row"""
        if not self.pool:
            await self.connect()
        
        if not self.pool:
            raise HTTPException(status_code=500, detail="Database unavailable")
        
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

db = NeonDatabase()

# ============= DATA MODELS =============

class CaseType(str, Enum):
    litigation = "LITIGATION"
    contract = "CONTRACT"
    merger = "MERGER"
    compliance = "COMPLIANCE"
    intellectual_property = "INTELLECTUAL_PROPERTY"

class LegalCaseRequest(BaseModel):
    client_name: str
    case_type: CaseType
    jurisdiction: Optional[str] = "US"
    priority: str = "normal"
    auto_provision: bool = True
    description: Optional[str] = None

class DocumentAnalysisRequest(BaseModel):
    case_id: str
    document_name: str
    analysis_type: str = "contract_review"
    content: Optional[str] = None

class TransactionRequest(BaseModel):
    amount: float
    from_account: str = Field(alias="from")
    to_account: str = Field(alias="to")
    currency: str = "USD"
    transaction_type: str = "TRANSFER"
    case_id: Optional[str] = None
    description: Optional[str] = None

class DeploymentRequest(BaseModel):
    script_name: str
    script_content: str
    case_id: Optional[str] = None
    environment: str = "production"
    resource_type: str = "worker"

# ============= CHITTYOS FUNCTIONS =============

async def generate_chitty_id(prefix: str = "CHITTY") -> str:
    """Generate a ChittyID"""
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
    random_part = os.urandom(4).hex().upper()
    return f"{prefix}-{timestamp}-{random_part}"

async def create_event_entry(event_type: str, aggregate_id: str, aggregate_type: str, 
                           event_data: Dict, user_id: Optional[str] = None) -> str:
    """Create event store entry for audit trail"""
    chitty_id = await generate_chitty_id("EVENT")
    
    query = """
        INSERT INTO event_store (
            chitty_id, aggregate_id, aggregate_type, event_type, 
            event_data, event_version, user_id, timestamp, event_hash
        )
        VALUES ($1, $2, $3, $4, $5, 
            (SELECT COALESCE(MAX(event_version), 0) + 1 FROM event_store WHERE aggregate_id = $2),
            $6, $7, $8)
        RETURNING id
    """
    
    event_hash = str(hash(json.dumps(event_data, sort_keys=True)))
    
    try:
        result = await db.fetchrow(
            query, chitty_id, aggregate_id, aggregate_type, event_type,
            json.dumps(event_data), user_id, datetime.now(timezone.utc), event_hash
        )
        return str(result['id']) if result else None
    except Exception as e:
        logger.error(f"Event store error: {e}")
        return None

# ============= API ENDPOINTS =============

@app.on_event("startup")
async def startup_event():
    """Initialize database connection on startup"""
    await db.connect()
    logger.info("ChittyOS API started")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up database connection on shutdown"""
    await db.disconnect()
    logger.info("ChittyOS API shutdown")

@app.post("/legal/cases")
async def create_legal_case(
    request: LegalCaseRequest,
    token: str = Depends(verify_token)
):
    """Create legal case in ChittyOS database"""
    try:
        # Generate IDs
        case_id = f"CASE-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{request.client_name[:3].upper()}"
        chitty_id = await generate_chitty_id("CASE")
        
        # Insert into database using existing schema
        query = """
            INSERT INTO matters (
                chitty_id, title, matter_type, status, client_entity_id,
                jurisdiction, priority, metadata
            )
            VALUES ($1, $2, $3, $4, 
                (SELECT id FROM people WHERE legal_name = $5 LIMIT 1),
                $6, $7, $8)
            RETURNING id, chitty_id
        """
        
        metadata = {
            "case_id": case_id,
            "auto_provisioned": request.auto_provision,
            "description": request.description
        }
        
        result = await db.fetchrow(
            query, chitty_id, f"{request.client_name} - {request.case_type.value}",
            request.case_type.value, "ACTIVE", request.client_name,
            request.jurisdiction, request.priority.upper(), json.dumps(metadata)
        )
        
        if result:
            # Create event store entry
            await create_event_entry(
                "CASE_CREATED", str(result['id']), "MATTER",
                {"client": request.client_name, "type": request.case_type.value}
            )
            
            # Auto-provision infrastructure if requested
            infrastructure = {}
            if request.auto_provision:
                infrastructure = {
                    "worker": f"{case_id.lower()}-worker",
                    "database": f"{case_id.lower()}-db",
                    "storage": f"{case_id.lower()}-docs"
                }
            
            return {
                "case_id": case_id,
                "chitty_id": result['chitty_id'],
                "status": "created",
                "infrastructure": infrastructure
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create case")
            
    except Exception as e:
        logger.error(f"Case creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/documents/analyze")
async def analyze_document(
    document: UploadFile = File(None),
    case_id: str = Form(...),
    analysis_type: str = Form("contract_review"),
    token: str = Depends(verify_token)
):
    """Analyze legal document and store in database"""
    try:
        # Generate document ID
        document_id = await generate_chitty_id("DOC")
        
        # Read document content if provided
        content = None
        if document:
            content = await document.read()
            file_size = len(content)
        else:
            file_size = 0
        
        # Insert document record
        query = """
            INSERT INTO documents (
                chitty_id, title, document_type, content_hash,
                file_size, status, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, chitty_id
        """
        
        metadata = {
            "case_id": case_id,
            "analysis_type": analysis_type,
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        }
        
        content_hash = str(hash(content)) if content else None
        
        result = await db.fetchrow(
            query, document_id, document.filename if document else "Analysis Request",
            analysis_type, content_hash, file_size, "ANALYZING", json.dumps(metadata)
        )
        
        if result:
            # Simulated analysis results
            analysis = {
                "document_id": result['chitty_id'],
                "case_id": case_id,
                "risk_score": 75.5,
                "compliance_status": "compliant",
                "key_findings": [
                    "Liability clause needs review",
                    "Termination conditions are standard",
                    "IP assignment is comprehensive"
                ],
                "recommendations": [
                    "Add arbitration clause",
                    "Specify jurisdiction explicitly",
                    "Include force majeure provisions"
                ]
            }
            
            # Create event entry
            await create_event_entry(
                "DOCUMENT_ANALYZED", str(result['id']), "DOCUMENT",
                analysis
            )
            
            return analysis
        else:
            raise HTTPException(status_code=500, detail="Failed to analyze document")
            
    except Exception as e:
        logger.error(f"Document analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transactions")
async def create_transaction(
    request: TransactionRequest,
    token: str = Depends(verify_token)
):
    """Create financial transaction in database"""
    try:
        # Generate transaction ID
        transaction_id = await generate_chitty_id("TXN")
        
        # Insert transaction
        query = """
            INSERT INTO transactions (
                chitty_id, amount, currency, from_entity_id, to_entity_id,
                transaction_type, status, metadata
            )
            VALUES ($1, $2, $3, 
                (SELECT id FROM people WHERE legal_name = $4 LIMIT 1),
                (SELECT id FROM people WHERE legal_name = $5 LIMIT 1),
                $6, $7, $8)
            RETURNING id, chitty_id
        """
        
        metadata = {
            "case_id": request.case_id,
            "description": request.description,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = await db.fetchrow(
            query, transaction_id, request.amount, request.currency,
            request.from_account, request.to_account, request.transaction_type,
            "PENDING", json.dumps(metadata)
        )
        
        if result:
            # Create event entry
            await create_event_entry(
                "TRANSACTION_CREATED", str(result['id']), "TRANSACTION",
                {
                    "amount": request.amount,
                    "from": request.from_account,
                    "to": request.to_account
                }
            )
            
            return {
                "transaction_id": result['chitty_id'],
                "status": "pending",
                "amount": request.amount,
                "blockchain_tx": f"0x{'0' * 64}"  # Simulated
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create transaction")
            
    except Exception as e:
        logger.error(f"Transaction creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/deployments")
async def create_deployment(
    request: DeploymentRequest,
    token: str = Depends(verify_token)
):
    """Record infrastructure deployment in database"""
    try:
        deployment_id = await generate_chitty_id("DEPLOY")
        
        # Store deployment record (using documents table for now)
        query = """
            INSERT INTO documents (
                chitty_id, title, document_type, content_hash, 
                status, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, chitty_id
        """
        
        metadata = {
            "case_id": request.case_id,
            "environment": request.environment,
            "resource_type": request.resource_type,
            "deployed_at": datetime.now(timezone.utc).isoformat(),
            "script_content": request.script_content[:1000]  # Store first 1000 chars
        }
        
        content_hash = str(hash(request.script_content))
        
        result = await db.fetchrow(
            query, deployment_id, request.script_name, "DEPLOYMENT",
            content_hash, "DEPLOYED", json.dumps(metadata)
        )
        
        if result:
            # Create event entry
            await create_event_entry(
                "INFRASTRUCTURE_DEPLOYED", str(result['id']), "DEPLOYMENT",
                {
                    "script_name": request.script_name,
                    "environment": request.environment,
                    "resource_type": request.resource_type
                }
            )
            
            return {
                "deployment_id": result['chitty_id'],
                "script_name": request.script_name,
                "status": "deployed",
                "url": f"https://{request.script_name}.workers.dev"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to record deployment")
            
    except Exception as e:
        logger.error(f"Deployment recording failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint with database status"""
    db_status = "connected" if db.pool else "disconnected"
    
    # Try to query database
    try:
        result = await db.fetchrow("SELECT version()")
        db_version = result['version'] if result else "unknown"
    except:
        db_version = "unavailable"
        db_status = "error"
    
    return {
        "status": "healthy",
        "service": "ChittyOS ChatGPT Integration",
        "database": db_status,
        "db_version": db_version,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/schema/info")
async def get_schema_info(token: str = Depends(verify_token)):
    """Get information about the database schema"""
    try:
        # Get schema version
        version_query = """
            SELECT version, description, applied_at 
            FROM schema_versions 
            ORDER BY applied_at DESC LIMIT 1
        """
        version_info = await db.fetchrow(version_query)
        
        # Get table list
        tables_query = """
            SELECT table_name, 
                   pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size,
                   (SELECT COUNT(*) FROM information_schema.columns 
                    WHERE table_name = t.table_name) as column_count
            FROM information_schema.tables t
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """
        tables = await db.fetch(tables_query)
        
        return {
            "schema_version": version_info['version'] if version_info else "unknown",
            "description": version_info['description'] if version_info else None,
            "applied_at": version_info['applied_at'].isoformat() if version_info else None,
            "tables": [
                {
                    "name": t['table_name'],
                    "size": t['size'],
                    "columns": t['column_count']
                } for t in tables
            ] if tables else [],
            "connection": "schema.chitty.cc"
        }
    except Exception as e:
        logger.error(f"Schema info error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/openapi.json")
async def get_openapi():
    """Return OpenAPI spec for ChatGPT"""
    return app.openapi()

# Vercel handler
handler = app