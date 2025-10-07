#!/usr/bin/env node

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

console.log('🧪 Running All Tests for Doomsday Indexer\n')
console.log('='.repeat(50))

const testFiles = [
  'phase1-setup.test.js',
  'service-health.test.js',
  'redis-connection.test.js',
]

let allPassed = true

testFiles.forEach((testFile, index) => {
  const testPath = path.join(__dirname, testFile)

  if (!fs.existsSync(testPath)) {
    console.log(`❌ Test file not found: ${testFile}`)
    allPassed = false
    return
  }

  console.log(`\n[${index + 1}/${testFiles.length}] Running ${testFile}...`)
  console.log('-'.repeat(50))

  try {
    execSync(`node ${testPath}`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    })
  } catch (error) {
    console.log(`❌ Test suite failed: ${testFile}`)
    allPassed = false
  }
})

console.log('\n' + '='.repeat(50))

if (allPassed) {
  console.log('✅ All test suites passed!')
  process.exit(0)
} else {
  console.log('❌ Some test suites failed!')
  process.exit(1)
}
