#!/usr/bin/env node

const Redis = require('ioredis');

console.log('🔴 Testing Redis Connection...\n');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  retryStrategy: () => null, // Don't retry, just fail fast
  maxRetriesPerRequest: 1,
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully!');
  testRedis();
});

redis.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    console.log('❌ Redis is not running.');
    console.log('\nTo start Redis, choose one option:');
    console.log('\n1. Using Docker (recommended):');
    console.log('   docker run -d -p 6379:6379 redis:7-alpine');
    console.log('\n2. Using docker-compose:');
    console.log('   docker-compose up -d redis');
    console.log('\n3. Install locally:');
    console.log('   Mac: brew install redis && brew services start redis');
    console.log('   Linux: sudo apt-get install redis-server');
  } else {
    console.log('❌ Redis error:', err.message);
  }
  process.exit(1);
});

async function testRedis() {
  try {
    // Test basic operations
    await redis.set('test:key', 'test-value');
    const value = await redis.get('test:key');

    if (value === 'test-value') {
      console.log('✅ Redis read/write test passed');
    }

    // Test BullMQ compatibility
    await redis.set('bull:test', JSON.stringify({ test: true }));
    const bullTest = await redis.get('bull:test');

    if (bullTest) {
      console.log('✅ BullMQ compatibility test passed');
    }

    // Clean up
    await redis.del('test:key', 'bull:test');

    console.log('\n🎉 Redis is ready for the indexer!');
    console.log('\n📝 You can now run: npm run dev');

  } catch (error) {
    console.log('❌ Redis operation failed:', error.message);
  } finally {
    redis.disconnect();
    process.exit(0);
  }
}