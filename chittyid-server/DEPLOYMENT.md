# ChittyID Server Deployment Plan

## Infrastructure Requirements

### 1. Main Server (id.chitty.cc)
- **Platform**: Cloudflare Workers or AWS Lambda
- **Database**: PostgreSQL (Neon) for ID tracking
- **Cache**: Redis for nonce tracking
- **CDN**: Cloudflare for global distribution

### 2. Fallback Service (fallback.id.chitty.cc)
- **Platform**: Separate Cloudflare Workers (different regions)
- **Independence**: No shared dependencies with main server
- **Storage**: DynamoDB or Cloudflare KV for temporary storage

### 3. Drand Integration
- **Source**: Cloudflare drand beacon (https://drand.cloudflare.com)
- **Caching**: 30-second cache for beacon values
- **Fallback**: Multiple drand endpoints for resilience

## Development Phases

### Phase 1: Local Development (Current)
```bash
# Local server for testing
cd chittyid-server
npm install
npm run dev  # Runs on localhost:3000
```

### Phase 2: Staging Environment
- Deploy to Cloudflare Workers (staging)
- Subdomain: staging.id.chitty.cc
- Test with real drand beacon
- Verify VRF calculations

### Phase 3: Production Deployment
1. **Domain Setup**
   - Register id.chitty.cc domain
   - Configure Cloudflare DNS
   - SSL certificates (automatic with Cloudflare)

2. **Main Server Deployment**
   ```javascript
   // Deploy to Cloudflare Workers
   wrangler deploy --name chittyid-main
   ```

3. **Fallback Service Deployment**
   ```javascript
   // Deploy to separate workers
   wrangler deploy --name chittyid-fallback --region us-west
   wrangler deploy --name chittyid-fallback --region eu-central
   ```

4. **Database Setup (Neon)**
   ```sql
   -- Apply schema from research document
   -- Including chitty_id columns
   -- Merkle tree tracking tables
   ```

## API Endpoints Implementation

### Main Server (`id.chitty.cc`)
- `POST /api/v2/chittyid/mint` - Generate new ChittyID
- `GET /api/v2/chittyid/verify/{id}` - Verify ChittyID
- `POST /api/v2/chittyid/reconcile` - Reconcile fallback IDs

### Fallback Service (`fallback.id.chitty.cc`)
- `POST /api/v2/fallback/request` - Request fallback ID
- `GET /api/v2/fallback/status` - Check service health

## Security Implementation

### 1. Authentication
- API keys stored in environment variables
- Rate limiting per API key
- IP whitelisting for critical operations

### 2. Anti-Replay
- Redis cache for nonce tracking
- 60-second timestamp window
- HMAC signature verification

### 3. Content Binding
- SHA256 hash of content
- Included in VRF calculation
- Stored in checksum field

## Monitoring & Metrics

### Key Metrics to Track
- ID generation rate
- Fallback usage percentage
- Reconciliation success rate
- Drand beacon availability
- API response times

### Alerting Thresholds
- Main server downtime > 30 seconds
- Fallback usage > 10% of traffic
- Failed reconciliations > 5%
- Drand timeout > 2 seconds

## Testing Strategy

### 1. Unit Tests
- VRF calculation correctness
- Checksum validation
- Content binding verification

### 2. Integration Tests
- End-to-end ID generation
- Fallback failover simulation
- Reconciliation process

### 3. Load Testing
- 10,000 requests/second target
- Fallback service resilience
- Database connection pooling

## Cost Estimates

### Cloudflare Workers
- Free tier: 100,000 requests/day
- Paid: $5/month + $0.50 per million requests

### Neon Database
- Free tier: 3GB storage
- Pro: $19/month for 10GB + autoscaling

### Redis (Upstash)
- Free tier: 10,000 commands/day
- Pay-as-you-go: $0.2 per 100K commands

## Timeline

- **Week 1**: Local server development
- **Week 2**: Staging deployment & testing
- **Week 3**: Production deployment
- **Week 4**: Monitoring & optimization

## Next Steps

1. Complete local server implementation
2. Register id.chitty.cc domain
3. Set up Cloudflare account
4. Configure Neon database
5. Deploy staging environment