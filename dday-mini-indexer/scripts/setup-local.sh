#!/bin/bash

# Local Development Setup Script (No Docker Required)

echo "🚀 Setting up Doomsday Indexer for local development..."
echo "=================================================="

# Check if PostgreSQL is installed
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL found"
else
    echo "❌ PostgreSQL not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "📦 Installing PostgreSQL via Homebrew..."
        brew install postgresql@15
        brew services start postgresql@15
    else
        echo "Please install PostgreSQL manually:"
        echo "  Ubuntu: sudo apt-get install postgresql"
        echo "  Mac: brew install postgresql"
        exit 1
    fi
fi

# Check if Redis is installed
if command -v redis-cli &> /dev/null; then
    echo "✅ Redis found"
else
    echo "❌ Redis not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "📦 Installing Redis via Homebrew..."
        brew install redis
        brew services start redis
    else
        echo "Please install Redis manually:"
        echo "  Ubuntu: sudo apt-get install redis-server"
        echo "  Mac: brew install redis"
        exit 1
    fi
fi

echo ""
echo "📝 Creating PostgreSQL user and database..."
echo "--------------------------------------------"

# Create user and database
psql -U postgres << EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'doomsday_admin') THEN
        CREATE USER doomsday_admin WITH PASSWORD 'doomsday_secure_pwd_2024';
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE doomsday_game OWNER doomsday_admin'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'doomsday_game')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE doomsday_game TO doomsday_admin;
EOF

echo ""
echo "🏗️  Initializing database schema..."
echo "------------------------------------"

# Run the schema
PGPASSWORD=doomsday_secure_pwd_2024 psql -U doomsday_admin -d doomsday_game -f init-db.sql

echo ""
echo "🔍 Verifying setup..."
echo "----------------------"

# Test PostgreSQL connection
PGPASSWORD=doomsday_secure_pwd_2024 psql -U doomsday_admin -d doomsday_game -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | grep -q "7" && echo "✅ PostgreSQL: All tables created" || echo "⚠️  PostgreSQL: Check table creation"

# Test Redis connection
redis-cli ping | grep -q "PONG" && echo "✅ Redis: Running" || echo "❌ Redis: Not responding"

echo ""
echo "✅ Local setup complete!"
echo ""
echo "📋 Services running locally:"
echo "  - PostgreSQL on port 5432"
echo "  - Redis on port 6379"
echo ""
echo "🎯 Next steps:"
echo "  1. Test connection: node test-db-connection.js"
echo "  2. Start development: npm run dev"
echo ""
echo "💡 To stop services:"
echo "  Mac: brew services stop postgresql redis"
echo "  Ubuntu: sudo systemctl stop postgresql redis"