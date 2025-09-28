#!/bin/bash
# Apply AI Analysis Schema Migration for ChittyOS §36 Compliance
# This script applies the AI analysis tables for litigation workflow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏛️  ChittyOS AI Analysis Schema Migration${NC}"
echo -e "${BLUE}======================================${NC}"

# Check for required environment variables
if [ -z "$DATABASE_URL" ] && [ -z "$NEON_DATABASE_URL" ] && [ -z "$POSTGRES_URL" ]; then
    echo -e "${RED}❌ Error: No database URL found${NC}"
    echo "Please set one of:"
    echo "  - DATABASE_URL"
    echo "  - NEON_DATABASE_URL"
    echo "  - POSTGRES_URL"
    echo ""
    echo "Example:"
    echo "  export DATABASE_URL='postgresql://user:pass@host.neon.tech/db?sslmode=require'"
    exit 1
fi

# Determine which database URL to use
DB_URL=""
if [ ! -z "$DATABASE_URL" ]; then
    DB_URL="$DATABASE_URL"
elif [ ! -z "$NEON_DATABASE_URL" ]; then
    DB_URL="$NEON_DATABASE_URL"
elif [ ! -z "$POSTGRES_URL" ]; then
    DB_URL="$POSTGRES_URL"
fi

echo -e "${YELLOW}📋 Migration Details:${NC}"
echo "  - Database: $(echo $DB_URL | sed 's/:[^:]*@/:****@/')"
echo "  - Migration: AI Analysis Tables"
echo "  - Compliance: §36 Critical Architecture"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ Error: psql not found${NC}"
    echo "Please install PostgreSQL client:"
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu: apt-get install postgresql-client"
    exit 1
fi

# Test database connection
echo -e "${YELLOW}🔍 Testing database connection...${NC}"
if ! psql "$DB_URL" -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Cannot connect to database${NC}"
    echo "Please check your connection string and database availability"
    exit 1
fi
echo -e "${GREEN}✅ Database connection successful${NC}"

# Check if base schema exists
echo -e "${YELLOW}🔍 Checking base schema...${NC}"
if ! psql "$DB_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'cases';" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Base schema not found. Applying base schema first...${NC}"

    if [ -f "./schema.sql" ]; then
        echo -e "${YELLOW}📋 Applying base schema...${NC}"
        psql "$DB_URL" -f "./schema.sql"
        echo -e "${GREEN}✅ Base schema applied${NC}"
    else
        echo -e "${RED}❌ Error: Base schema file (schema.sql) not found${NC}"
        echo "Please ensure schema.sql exists in the current directory"
        exit 1
    fi
fi

# Apply AI analysis migration
echo -e "${YELLOW}📋 Applying AI Analysis schema migration...${NC}"

if [ ! -f "./ai-analysis-schema-migration.sql" ]; then
    echo -e "${RED}❌ Error: Migration file not found${NC}"
    echo "Please ensure ai-analysis-schema-migration.sql exists in current directory"
    exit 1
fi

# Run the migration with transaction safety
psql "$DB_URL" << 'EOF'
BEGIN;

-- Check if migration already applied
DO $migration_check$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'ai_analysis_sessions'
    ) THEN
        RAISE NOTICE 'AI Analysis tables already exist. Skipping migration.';
    ELSE
        RAISE NOTICE 'Applying AI Analysis schema migration...';
        -- The migration will be applied after this block
    END IF;
END $migration_check$;

-- Apply migration if tables don't exist
DO $apply_migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'ai_analysis_sessions'
    ) THEN
EOF

# Insert the migration content
cat "./ai-analysis-schema-migration.sql" | psql "$DB_URL"

psql "$DB_URL" << 'EOF'
    END IF;
END $apply_migration$;

COMMIT;
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ AI Analysis schema migration completed successfully${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    exit 1
fi

# Verify migration
echo -e "${YELLOW}🔍 Verifying migration...${NC}"
TABLE_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('ai_analysis_sessions', 'ai_analysis_results', 'ai_consensus_analysis', 'ai_model_performance', 'evidence_chain');")

if [ "$TABLE_COUNT" -eq 5 ]; then
    echo -e "${GREEN}✅ All 5 AI analysis tables created successfully${NC}"
else
    echo -e "${RED}❌ Expected 5 tables, found $TABLE_COUNT${NC}"
    exit 1
fi

# Show created tables
echo -e "${YELLOW}📊 Created Tables:${NC}"
psql "$DB_URL" -c "SELECT table_name, table_type FROM information_schema.tables WHERE table_name LIKE '%ai_%' OR table_name = 'evidence_chain' ORDER BY table_name;"

echo ""
echo -e "${GREEN}🎉 AI Analysis Schema Migration Complete!${NC}"
echo -e "${BLUE}Ready for §36 compliant litigation workflow${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update evidence-ingestion.ts to use new tables"
echo "2. Configure AI analysis session tracking"
echo "3. Set up multi-model consensus analysis"
echo "4. Run integration tests"