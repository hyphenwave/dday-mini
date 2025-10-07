#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('🧪 Testing Phase 1 Setup for Doomsday Indexer\n')
console.log('='.repeat(50))

let testsPassed = 0
let testsFailed = 0

function runTest(name, testFn) {
  process.stdout.write(`\n📋 ${name}... `)
  try {
    testFn()
    console.log('✅ PASSED')
    testsPassed++
    return true
  } catch (error) {
    console.log('❌ FAILED')
    console.log(`   Error: ${error.message}`)
    testsFailed++
    return false
  }
}

// Test 1: Check directory structure
runTest('Directory Structure', () => {
  const requiredDirs = [
    'packages/shared',
    'packages/president-updater',
    'packages/price-updater',
    'packages/round-scheduler',
    'packages/amm-migrator',
    'packages/buyback-orchestrator',
    'packages/api-gateway',
  ]

  requiredDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      throw new Error(`Missing directory: ${dir}`)
    }
  })
})

// Test 2: Check package.json files
runTest('Package.json Files', () => {
  const packages = [
    'shared',
    'president-updater',
    'price-updater',
    'round-scheduler',
    'amm-migrator',
    'buyback-orchestrator',
    'api-gateway',
  ]

  packages.forEach((pkg) => {
    const packagePath = path.join('packages', pkg, 'package.json')
    if (!fs.existsSync(packagePath)) {
      throw new Error(`Missing package.json: ${packagePath}`)
    }
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
    if (!packageJson.name) {
      throw new Error(`Invalid package.json in ${pkg}`)
    }
  })
})

// Test 3: Check npm workspaces
runTest('NPM Workspaces Configuration', () => {
  const rootPackage = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
  if (!rootPackage.workspaces || !Array.isArray(rootPackage.workspaces)) {
    throw new Error('Workspaces not configured in root package.json')
  }
})

// Test 4: Check TypeScript configuration
runTest('TypeScript Configuration', () => {
  if (!fs.existsSync('tsconfig.json')) {
    throw new Error('Missing root tsconfig.json')
  }

  const packages = fs.readdirSync('packages')
  packages.forEach((pkg) => {
    const tsconfigPath = path.join('packages', pkg, 'tsconfig.json')
    if (!fs.existsSync(tsconfigPath)) {
      throw new Error(`Missing tsconfig.json in ${pkg}`)
    }
  })
})

// Test 5: Check if packages are installed
runTest('Dependencies Installed', () => {
  if (!fs.existsSync('node_modules')) {
    throw new Error('node_modules not found - run npm install')
  }

  // Check if key dependencies are installed
  const keyDeps = [
    '@solana/web3.js',
    '@coral-xyz/anchor',
    'bullmq',
    'ioredis',
    'winston',
  ]

  keyDeps.forEach((dep) => {
    if (!fs.existsSync(path.join('node_modules', dep))) {
      throw new Error(`Missing dependency: ${dep}`)
    }
  })
})

// Test 6: Build test
runTest('TypeScript Compilation', () => {
  console.log('\n   Building project (this may take a moment)...')
  execSync('npm run build', { stdio: 'ignore' })

  // Check if dist folders were created
  if (!fs.existsSync('packages/shared/dist')) {
    throw new Error('Build failed - no dist folder in shared package')
  }
})

// Test 7: Check environment configuration
runTest('Environment Configuration', () => {
  if (!fs.existsSync('.env.example')) {
    console.warn(
      '   ⚠️  Warning: .env.example not found, skipping presence check'
    )
    return
  }

  const envExample = fs.readFileSync('.env.example', 'utf-8')
  const requiredVars = [
    'SOLANA_RPC_ENDPOINT',
    'PROGRAM_ID',
    'REDIS_HOST',
    'REDIS_PORT',
  ]

  requiredVars.forEach((varName) => {
    if (!envExample.includes(varName)) {
      throw new Error(`Missing ${varName} in .env.example`)
    }
  })
})

// Test 8: Import test
runTest('Shared Library Imports', () => {
  try {
    const shared = require('../packages/shared/dist/index.js')

    // Check if key exports exist
    if (!shared.logger) throw new Error('logger not exported')
    if (!shared.config) throw new Error('config not exported')
    if (!shared.RPCManager) throw new Error('RPCManager not exported')
    if (!shared.DoomsdayClient) throw new Error('DoomsdayClient not exported')
  } catch (error) {
    throw new Error(`Failed to import shared library: ${error.message}`)
  }
})

// Test 9: Service startup test (dry run)
runTest('Service Startup (Dry Run)', () => {
  // Create a test .env file for dry run
  const testEnvContent = `
SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
PROGRAM_ID=CS5ZMcpfdSS7WTgTQp7xYeVN9af3UoAdrZyMgKr3s8Bt
REDIS_HOST=localhost
REDIS_PORT=6379
ENABLE_DRY_RUN=true
LOG_LEVEL=error
  `.trim()

  fs.writeFileSync('.env', testEnvContent)

  // Try to start a service (it will fail due to Redis, but that's ok for now)
  try {
    const {
      createLogger,
      config,
      validateConfig,
    } = require('../packages/shared/dist/index.js')
    validateConfig()
    const testLogger = createLogger('test')
    testLogger.info('Test logger working')
  } catch (error) {
    if (error.message.includes('AUTHORITY_KEYPAIR_PATH')) {
      // This is expected in dry-run mode, ignore
    } else if (
      !error.message.includes('Redis') &&
      !error.message.includes('ECONNREFUSED')
    ) {
      throw error
    }
  }
})

// Summary
console.log('\n' + '='.repeat(50))
console.log('📊 TEST RESULTS:')
console.log(`   ✅ Passed: ${testsPassed}`)
console.log(`   ❌ Failed: ${testsFailed}`)
console.log('='.repeat(50))

if (testsFailed === 0) {
  console.log('\n🎉 All Phase 1 tests passed! Your setup is ready for Phase 2.')
  console.log('\n📝 Next steps:')
  console.log('   1. Copy .env.example to .env and configure it')
  console.log('   2. Start Redis: docker-compose up -d redis')
  console.log('   3. Run services: npm run dev')
} else {
  console.log('\n⚠️  Some tests failed. Please fix the issues above.')
  process.exit(1)
}
