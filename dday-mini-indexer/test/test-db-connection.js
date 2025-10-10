#!/usr/bin/env node

const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

const poolConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'doomsday_game',
  user: process.env.POSTGRES_USER || 'doomsday_admin',
  password: process.env.POSTGRES_PASSWORD || 'doomsday_secure_pwd_2024'
};

console.log('Testing database connection with config:');
console.log({
  host: poolConfig.host,
  port: poolConfig.port,
  database: poolConfig.database,
  user: poolConfig.user
});

const pool = new Pool(poolConfig);

async function testConnection() {
  try {
    console.log('\n🔄 Attempting to connect to PostgreSQL...');

    const res = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Connected successfully!');
    console.log('📅 Server time:', res.rows[0].current_time);
    console.log('📦 PostgreSQL version:', res.rows[0].pg_version.split(' ')[1]);

    // Test if tables exist
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    const tablesRes = await pool.query(tablesQuery);

    if (tablesRes.rows.length > 0) {
      console.log('\n📋 Tables found in database:');
      tablesRes.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('\n⚠️  No tables found. You may need to run the init-db.sql script.');
    }

    // Test insert capability
    const testQuery = `
      INSERT INTO countries (id, name, mint_address)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name
      RETURNING *
    `;

    try {
      const testRes = await pool.query(testQuery, [1, 'United States', 'TEST_MINT_ADDRESS']);
      console.log('\n✅ Write test successful! Can insert/update data.');
      console.log('   Sample country:', testRes.rows[0]);
    } catch (err) {
      if (err.code === '42P01') {
        console.log('\n⚠️  Countries table does not exist. Schema needs to be initialized.');
      } else {
        console.log('\n❌ Write test failed:', err.message);
      }
    }

    await pool.end();
    console.log('\n✅ All tests completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Suggestions:');
      console.log('1. Make sure PostgreSQL is running:');
      console.log('   - If using Docker: docker compose up -d postgres');
      console.log('   - If installed locally: pg_ctl start or brew services start postgresql');
      console.log('2. Check if PostgreSQL is listening on port', poolConfig.port);
      console.log('3. Verify the connection settings in .env file');
    } else if (error.code === '28P01') {
      console.log('\n💡 Authentication failed. Check your username and password in .env');
    } else if (error.code === '3D000') {
      console.log('\n💡 Database does not exist. Create it with:');
      console.log(`   createdb -h ${poolConfig.host} -U ${poolConfig.user} ${poolConfig.database}`);
    }

    await pool.end();
    process.exit(1);
  }
}

testConnection();