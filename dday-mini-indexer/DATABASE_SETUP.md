# 🚀 Database Setup & Local Development Guide

> **Quick Start**: If you already have PostgreSQL and Redis installed, skip to step 3!

## Option A: Local Development (No Docker)

## Quick Setup for Mac

### 1. Install PostgreSQL and Redis (if not already installed)
```bash
# Install with Homebrew
brew install postgresql@15 redis

# Start services
brew services start postgresql@15
brew services start redis
```

### 2. Create Database and User
```bash
# Access PostgreSQL
psql -U postgres

# Run these commands in psql:
CREATE USER doomsday_admin WITH PASSWORD 'doomsday_secure_pwd_2024';
CREATE DATABASE doomsday_game OWNER doomsday_admin;
GRANT ALL PRIVILEGES ON DATABASE doomsday_game TO doomsday_admin;
\q

# Initialize the schema
PGPASSWORD=doomsday_secure_pwd_2024 psql -U doomsday_admin -d doomsday_game -f init-db.sql
```

### 3. Or Use the Automated Setup Script
```bash
# Run the setup script
./setup-local.sh
```

### 4. Test Everything Works
```bash
# Test database connection
node test-db-connection.js

# Should output:
# ✅ Connected successfully!
# 📋 Tables found in database:
#    - countries, presidents, price_history, etc.
```

## Starting Development

```bash
# Your services are already running in the background!

# Start the indexer services
npm run dev

# Or run individual services
npm run dev:president  # President updater only
npm run dev:api        # API gateway only
```

## Managing Local Services

```bash
# Check if services are running
brew services list

# Stop services when done
brew services stop postgresql@15
brew services stop redis

# Restart services
brew services restart postgresql@15
brew services restart redis
```

## Verify Everything is Working

```bash
# PostgreSQL
psql -U doomsday_admin -d doomsday_game -c "SELECT COUNT(*) FROM countries;"

# Redis
redis-cli ping
# Should return: PONG
```

## Common Issues

### "psql: FATAL: role 'postgres' does not exist"
```bash
# Create the postgres superuser
createuser -s postgres
```

### "psql: FATAL: database 'postgres' does not exist"
```bash
# Create the postgres database
createdb postgres
```

### Port already in use
```bash
# Check what's using the port
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# Kill the process if needed
kill -9 <PID>
```

## Option B: Using Docker

```bash
# If you prefer Docker:
docker compose up -d postgres redis

# Check services
docker ps

# View logs
docker compose logs -f postgres
```

## Database Schema

The database includes 7 tables for game data:
- **countries** - Static data for all 211 countries
- **presidents** - Current president for each country
- **president_history** - Historical record of all presidents
- **price_history** - Price snapshots over time (for charts)
- **rounds** - Game round information
- **nukes** - Nuclear attack records
- **chat_messages** - In-game chat messages

## That's It! 🎉

You're now running everything locally without Docker:
- ✅ PostgreSQL on localhost:5432
- ✅ Redis on localhost:6379
- ✅ All tables created
- ✅ Ready for development

No Docker daemon, no containers, just local services!