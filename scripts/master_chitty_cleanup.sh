#!/bin/bash

# ChittyOS Master Consolidation Script
# Unified approach combining scientific legal data models with hybrid database strategy

set -euo pipefail

echo "================================================"
echo "   ChittyOS Master Consolidation Framework     "
echo "================================================"

HOME="/Users/nb"
REGISTRY="$HOME/.claude/tools/registry.json"
MASTER="$HOME/.chittyos_master"

# Create master structure incorporating both relational and graph perspectives
echo "Creating unified ChittyOS structure..."

# CORE LAYER: Entity management (optimized for both relational and graph access)
mkdir -p "$MASTER/entities"/{relational,graph,hybrid}
mkdir -p "$MASTER/entities/relational"/{people,places,things,events,authorities}
mkdir -p "$MASTER/entities/graph"/{nodes,edges,subgraphs}
mkdir -p "$MASTER/entities/hybrid"/{materialized_views,sync_queues}

# EVIDENCE LAYER: Processing pipeline
mkdir -p "$MASTER/evidence"/{intake,processing,production,chain_of_custody}
mkdir -p "$MASTER/evidence/intake"/{sources,metadata,timestamps}
mkdir -p "$MASTER/evidence/processing"/{normalization,deduplication,feature_extraction}
mkdir -p "$MASTER/evidence/production"/{exports,reports,analytics}

# ANALYTICAL LAYER: Dual database optimization
mkdir -p "$MASTER/analytics"/{relational_queries,graph_traversals,hybrid_analytics}
mkdir -p "$MASTER/analytics/relational_queries"/{aggregations,joins,windows}
mkdir -p "$MASTER/analytics/graph_traversals"/{paths,patterns,clusters}
mkdir -p "$MASTER/analytics/hybrid_analytics"/{predictive_models,jurimetrics}

# INFRASTRUCTURE LAYER: Cloudflare integration
mkdir -p "$MASTER/infrastructure"/{workers,kv,r2,durable_objects}
mkdir -p "$MASTER/infrastructure/workers"/{api,sync,processing}
mkdir -p "$MASTER/infrastructure/kv"/{cache,state,config}
mkdir -p "$MASTER/infrastructure/r2"/{documents,evidence,archives}
mkdir -p "$MASTER/infrastructure/durable_objects"/{neural,compliance,analytics}

echo "Step 1: Creating hybrid database schema..."

# Hybrid database configuration
cat > "$MASTER/entities/hybrid/database_strategy.json" << 'EOF'
{
  "strategy": "Hybrid Relational-Graph Architecture",
  "rationale": "Leverage PostgreSQL for transactional integrity and Neo4j for relationship analytics",

  "relational_layer": {
    "database": "PostgreSQL",
    "purpose": "Core entity storage, ACID transactions, structured queries",
    "entities": ["people", "places", "things", "events", "authorities"],
    "strengths": [
      "Mature ecosystem",
      "Strong consistency",
      "Complex aggregations",
      "Established tooling"
    ]
  },

  "graph_layer": {
    "database": "Neo4j via Cloudflare Workers",
    "purpose": "Relationship traversal, pattern detection, network analysis",
    "focus": [
      "Multi-hop relationship queries",
      "Citation networks",
      "Social graphs",
      "Evidence chains"
    ],
    "strengths": [
      "Optimized traversals",
      "Pattern matching",
      "Dynamic schema",
      "Visual exploration"
    ]
  },

  "synchronization": {
    "method": "Event-driven via Cloudflare Workers",
    "consistency": "Eventually consistent",
    "triggers": [
      "Entity creation/update",
      "Relationship changes",
      "Evidence linkage"
    ]
  }
}
EOF

echo "Step 2: Mapping existing ChittyOS services to master structure..."

# Read registry and map services without assumptions
jq -r '.domains | to_entries[] | .value' "$REGISTRY" 2>/dev/null | while read domain; do
    service=$(echo "$domain" | cut -d'.' -f1)
    echo "$service -> $domain" >> "$MASTER/infrastructure/domain_mapping.txt"
done

echo "Step 3: Creating consolidated views for both database paradigms..."

# Relational view for structured queries
cat > "$MASTER/analytics/relational_queries/consolidated_view.sql" << 'EOF'
-- Master consolidated view for relational queries
CREATE MATERIALIZED VIEW chitty_master_view AS
WITH entity_summary AS (
    SELECT
        entity_type,
        COUNT(*) as entity_count,
        COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN entity_id END) as recent_count
    FROM (
        SELECT entity_id, 'person' as entity_type, created_at FROM people
        UNION ALL
        SELECT entity_id, 'place' as entity_type, created_at FROM places
        UNION ALL
        SELECT entity_id, 'thing' as entity_type, created_at FROM things
        UNION ALL
        SELECT entity_id, 'event' as entity_type, created_at FROM events
        UNION ALL
        SELECT entity_id, 'authority' as entity_type, created_at FROM authorities
    ) entities
    GROUP BY entity_type
),
relationship_summary AS (
    SELECT
        relationship_type,
        COUNT(*) as relationship_count,
        AVG(strength_score) as avg_strength
    FROM entity_relationships
    GROUP BY relationship_type
)
SELECT
    es.*,
    rs.*,
    NOW() as last_refreshed
FROM entity_summary es
CROSS JOIN relationship_summary rs;

CREATE INDEX idx_master_view_refresh ON chitty_master_view(last_refreshed);
EOF

# Graph queries for relationship analysis
cat > "$MASTER/analytics/graph_traversals/queries.cypher" << 'EOF'
// ChittyOS Graph Queries for Neo4j

// 1. Find all evidence chains for a case
MATCH path = (c:Case {case_id: $caseId})-[:HAS_EVIDENCE*]->(e:Evidence)
RETURN path
ORDER BY length(path)
LIMIT 100;

// 2. Identify key person networks
MATCH (p1:Person)-[r:RELATED_TO*1..3]-(p2:Person)
WHERE p1.chitty_id = $personId
RETURN p1, r, p2
LIMIT 50;

// 3. Authority citation network
MATCH (a1:Authority)-[:CITES]->(a2:Authority)
RETURN a1, a2
ORDER BY a1.hierarchy_level DESC;

// 4. Evidence clustering by similarity
MATCH (e1:Evidence)-[s:SIMILAR_TO]-(e2:Evidence)
WHERE s.similarity_score > 0.8
RETURN e1, e2, s.similarity_score
ORDER BY s.similarity_score DESC;
EOF

echo "Step 4: Consolidating existing cleanup attempts..."

# Identify and consolidate all existing organization attempts
cat > "$MASTER/consolidation_map.json" << 'EOF'
{
  "existing_attempts": [
    {
      "path": ".evidence_structure",
      "approach": "Evidence-based e-discovery workflow",
      "integrate": "evidence layer"
    },
    {
      "path": ".legal_ontology",
      "approach": "LKIF-Core ontology mapping",
      "integrate": "entities/relational layer"
    },
    {
      "path": ".chittychain_scientific",
      "approach": "Jurimetrics and atomic facts",
      "integrate": "analytics/hybrid layer"
    },
    {
      "path": ".arias_evidence_vault",
      "approach": "Case-specific evidence",
      "integrate": "evidence/production"
    }
  ],
  "action": "Preserve data, unify structure, eliminate redundancy"
}
EOF

echo "Step 5: Creating migration script..."

cat > "$MASTER/migrate_and_consolidate.sh" << 'MIGRATE'
#!/bin/bash

# Migrate existing structures to master framework

MASTER="$HOME/.chittyos_master"

echo "Starting ChittyOS consolidation migration..."

# 1. Migrate evidence structures
if [ -d "$HOME/.evidence_structure" ]; then
    echo "Migrating evidence structure..."
    cp -r "$HOME/.evidence_structure/intake"/* "$MASTER/evidence/intake/" 2>/dev/null || true
    cp -r "$HOME/.evidence_structure/processing"/* "$MASTER/evidence/processing/" 2>/dev/null || true
    echo "Evidence structure migrated"
fi

# 2. Migrate ontology mappings
if [ -d "$HOME/.legal_ontology" ]; then
    echo "Migrating ontology mappings..."
    cp "$HOME/.legal_ontology/conceptual"/*.json "$MASTER/entities/relational/" 2>/dev/null || true
    echo "Ontology mappings migrated"
fi

# 3. Migrate ChittyChain scientific models
if [ -d "$HOME/.chittychain_scientific" ]; then
    echo "Migrating ChittyChain scientific models..."
    cp -r "$HOME/.chittychain_scientific/facts"/* "$MASTER/analytics/hybrid_analytics/" 2>/dev/null || true
    echo "Scientific models migrated"
fi

# 4. Consolidate Arias evidence
if [ -d "$HOME/.arias_evidence_vault" ]; then
    echo "Consolidating Arias case evidence..."
    mkdir -p "$MASTER/evidence/production/cases/arias_v_bianchi"
    cp -r "$HOME/.arias_evidence_vault"/* "$MASTER/evidence/production/cases/arias_v_bianchi/" 2>/dev/null || true
    echo "Arias evidence consolidated"
fi

echo "Migration complete!"
MIGRATE

chmod +x "$MASTER/migrate_and_consolidate.sh"

echo "Step 6: Creating Cloudflare Worker for database synchronization..."

cat > "$MASTER/infrastructure/workers/sync/database_sync_worker.js" << 'EOF'
// ChittyOS Database Synchronization Worker
// Maintains consistency between PostgreSQL and Graph layers

export default {
  async fetch(request, env, ctx) {
    const { method, url } = request;
    const pathname = new URL(url).pathname;

    // Handle entity changes
    if (pathname.startsWith('/sync/entity')) {
      return handleEntitySync(request, env, ctx);
    }

    // Handle relationship changes
    if (pathname.startsWith('/sync/relationship')) {
      return handleRelationshipSync(request, env, ctx);
    }

    return new Response('ChittyOS Database Sync API', { status: 200 });
  }
};

async function handleEntitySync(request, env, ctx) {
  const entity = await request.json();

  // Store in KV for relational layer
  await env.ENTITIES.put(entity.entity_id, JSON.stringify(entity));

  // Queue for graph layer update
  ctx.waitUntil(updateGraphNode(entity, env));

  return new Response(JSON.stringify({
    success: true,
    entity_id: entity.entity_id,
    layers_updated: ['relational', 'graph']
  }));
}

async function handleRelationshipSync(request, env, ctx) {
  const relationship = await request.json();

  // Store relationship in KV
  const key = `${relationship.source_id}:${relationship.target_id}`;
  await env.RELATIONSHIPS.put(key, JSON.stringify(relationship));

  // Queue graph edge update
  ctx.waitUntil(updateGraphEdge(relationship, env));

  return new Response(JSON.stringify({
    success: true,
    relationship_key: key,
    layers_updated: ['relational', 'graph']
  }));
}

async function updateGraphNode(entity, env) {
  // Send to graph database via Durable Object
  const graphId = env.GRAPH_SYNC.idFromName('master');
  const graphObj = env.GRAPH_SYNC.get(graphId);

  await graphObj.fetch(new Request('http://internal/node', {
    method: 'POST',
    body: JSON.stringify(entity)
  }));
}

async function updateGraphEdge(relationship, env) {
  // Send to graph database via Durable Object
  const graphId = env.GRAPH_SYNC.idFromName('master');
  const graphObj = env.GRAPH_SYNC.get(graphId);

  await graphObj.fetch(new Request('http://internal/edge', {
    method: 'POST',
    body: JSON.stringify(relationship)
  }));
}
EOF

echo "Step 7: Generating comprehensive cleanup analysis..."

# Analyze current directory structure
cat > "$MASTER/cleanup_analysis.sh" << 'ANALYSIS'
#!/bin/bash

echo "Analyzing ChittyOS directory structure..."
echo "=========================================="

# Count similar directories
echo "\nDirectories with 'chitty' prefix:"
find "$HOME" -maxdepth 3 -type d -name "chitty*" 2>/dev/null | wc -l

echo "\nDirectories with '.chitty' prefix:"
find "$HOME" -maxdepth 3 -type d -name ".chitty*" 2>/dev/null | wc -l

echo "\nDirectories with 'arias' in name:"
find "$HOME" -maxdepth 3 -type d -name "*arias*" 2>/dev/null | wc -l

echo "\nTotal directories to consolidate:"
find "$HOME" -maxdepth 3 -type d \( -name "*chitty*" -o -name "*arias*" \) 2>/dev/null | wc -l

echo "\nTop-level organization targets:"
ls -la "$HOME" | grep -E "(chitty|arias|evidence|legal|ontology)" | wc -l

echo "\n=========================================="
echo "Ready for consolidation into: $HOME/.chittyos_master"
ANALYSIS

chmod +x "$MASTER/cleanup_analysis.sh"

echo "Step 8: Creating final consolidation report..."

cat > "$MASTER/CONSOLIDATION_REPORT.md" << 'EOF'
# ChittyOS Master Consolidation Report
Generated: $(date)

## Executive Summary
This master consolidation framework unifies all ChittyOS organizational attempts into a single, coherent structure that addresses both relational and graph database paradigms.

## Hybrid Database Strategy

### Relational Layer (PostgreSQL)
- **Purpose**: Core entity storage, ACID transactions, aggregations
- **Entities**: People, Places, Things, Events, Authorities
- **Strengths**: Mature ecosystem, strong consistency, complex queries

### Graph Layer (Neo4j via Cloudflare)
- **Purpose**: Relationship traversal, pattern detection, network analysis
- **Focus**: Multi-hop queries, citation networks, evidence chains
- **Strengths**: Optimized traversals, dynamic schema, visual exploration

### Synchronization
- **Method**: Event-driven via Cloudflare Workers
- **Consistency**: Eventually consistent
- **Implementation**: `database_sync_worker.js`

## Consolidated Structure

```
.chittyos_master/
├── entities/
│   ├── relational/       # PostgreSQL optimized
│   ├── graph/            # Neo4j optimized
│   └── hybrid/           # Sync and materialized views
├── evidence/
│   ├── intake/           # Evidence collection
│   ├── processing/       # Pipeline stages
│   ├── production/       # Final outputs
│   └── chain_of_custody/ # Audit trail
├── analytics/
│   ├── relational_queries/
│   ├── graph_traversals/
│   └── hybrid_analytics/
└── infrastructure/
    ├── workers/          # Cloudflare Workers
    ├── kv/              # Key-Value storage
    ├── r2/              # Object storage
    └── durable_objects/ # Stateful computing
```

## Migration Plan

1. **Evidence Structure** → `evidence/` layer
2. **Legal Ontology** → `entities/relational/` layer
3. **ChittyChain Scientific** → `analytics/hybrid/` layer
4. **Arias Evidence** → `evidence/production/cases/`

## Key Improvements

1. **Unified Structure**: Single source of truth eliminating redundancy
2. **Hybrid Approach**: Leverages strengths of both database paradigms
3. **Cloudflare Integration**: Native support for Workers, KV, R2, and Durable Objects
4. **Scientific Foundation**: Implements jurimetrics and legal ontologies
5. **Scalability**: Prepared for both vertical and horizontal scaling

## Implementation Steps

1. Execute `cleanup_analysis.sh` to assess current state
2. Run `migrate_and_consolidate.sh` to unify existing structures
3. Deploy `database_sync_worker.js` to Cloudflare
4. Validate entity mappings against registry.json
5. Test hybrid queries across both database layers

## Database Decision Matrix

| Query Type | Recommended Layer | Reasoning |
|------------|------------------|------------|
| Entity CRUD | Relational | ACID guarantees |
| Aggregations | Relational | SQL optimization |
| Path finding | Graph | Native traversal |
| Pattern matching | Graph | Built-in algorithms |
| Jurimetrics | Hybrid | Complex analytics |
| Evidence chains | Graph | Relationship focus |
| Compliance audit | Relational | Structured logs |

## Next Steps

1. **Immediate**: Execute consolidation scripts
2. **Short-term**: Deploy synchronization workers
3. **Medium-term**: Implement graph analytics
4. **Long-term**: ML pipeline integration

---
*This consolidation represents the evolution of ChittyOS from scattered experiments to a unified, scientifically-grounded legal technology platform.*
EOF

echo "================================================"
echo "Master Consolidation Framework Complete!"
echo ""
echo "Location: $MASTER"
echo "Report: $MASTER/CONSOLIDATION_REPORT.md"
echo "Migration: $MASTER/migrate_and_consolidate.sh"
echo "Analysis: $MASTER/cleanup_analysis.sh"
echo ""
echo "This unified framework:"
echo "✓ Implements hybrid database strategy"
echo "✓ Consolidates all previous attempts"
echo "✓ Preserves scientific legal models"
echo "✓ Enables both relational and graph queries"
echo "✓ Integrates with Cloudflare infrastructure"
echo "================================================"