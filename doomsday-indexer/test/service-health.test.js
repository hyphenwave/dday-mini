#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

console.log('🏥 Service Health Check Tests\n')
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

// Test each service has required files
const services = [
  'president-updater',
  'price-updater',
  'round-scheduler',
  'amm-migrator',
  'buyback-orchestrator',
  'api-gateway',
]

services.forEach((service) => {
  runTest(`${service} structure`, () => {
    const servicePath = path.join('packages', service)

    // Check package.json
    const packageJsonPath = path.join(servicePath, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`Missing package.json`)
    }

    // Check tsconfig
    const tsconfigPath = path.join(servicePath, 'tsconfig.json')
    if (!fs.existsSync(tsconfigPath)) {
      throw new Error(`Missing tsconfig.json`)
    }

    // Check if dist exists after build
    const distPath = path.join(servicePath, 'dist')
    if (fs.existsSync(distPath)) {
      // Check if index.js was generated
      const indexPath = path.join(distPath, 'index.js')
      if (!fs.existsSync(indexPath) && service !== 'shared') {
        console.warn(`\n   ⚠️  Warning: No index.js in dist folder`)
      }
    }

    // Verify dependencies
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    if (
      !packageJson.dependencies ||
      !packageJson.dependencies['@doomsday/shared']
    ) {
      throw new Error(`Missing @doomsday/shared dependency`)
    }
  })
})

// Test shared library exports
runTest('Shared library exports', () => {
  const sharedExports = require('../packages/shared/dist/index.js')

  const requiredExports = [
    'logger',
    'createLogger',
    'config',
    'validateConfig',
    'RPCManager',
    'WorldPvPClient',
    'CountryStatus',
    'MarketMode',
    'QuoteSource',
  ]

  requiredExports.forEach((exportName) => {
    if (!sharedExports[exportName]) {
      throw new Error(`Missing export: ${exportName}`)
    }
  })
})

// Test configuration loading
runTest('Configuration system', () => {
  // Save current env
  const originalEnv = process.env.NODE_ENV

  // Test different environments
  process.env.NODE_ENV = 'development'
  delete require.cache[
    require.resolve('../packages/shared/dist/config/index.js')
  ]
  const devConfig = require('../packages/shared/dist/config/index.js').config

  if (!devConfig.solana || !devConfig.redis || !devConfig.api) {
    throw new Error('Configuration structure invalid')
  }

  // Restore env
  process.env.NODE_ENV = originalEnv
})

// Summary
console.log('\n' + '='.repeat(50))
console.log('📊 SERVICE HEALTH CHECK RESULTS:')
console.log(`   ✅ Passed: ${testsPassed}`)
console.log(`   ❌ Failed: ${testsFailed}`)
console.log('='.repeat(50))

if (testsFailed === 0) {
  console.log('\n✅ All service health checks passed!')
} else {
  console.log('\n⚠️  Some health checks failed.')
  process.exit(1)
}
