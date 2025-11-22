# Filecoin Cloud Plugin Tests

This directory contains comprehensive tests for the Filecoin Cloud DWN plugin.

## Test Files

### `plugin.test.js`
Functional tests that verify basic plugin operations:
- ✅ Basic write/read operations
- ✅ JSON data handling
- ✅ Large data (>127 bytes) with padding
- ✅ Small data (<127 bytes) with automatic padding
- ✅ Non-existent key handling
- ✅ Delete operations
- ✅ Cloud status checking

### `performance.test.js`
Performance tests to measure plugin efficiency:
- ⚡ Write performance (writes per second)
- ⚡ Read performance (reads per second)
- ⚡ Concurrent operations testing

### `run-all-tests.js`
Complete test suite runner that executes all tests and provides a summary.

## Running Tests

### Run All Tests
```bash
node tests/run-all-tests.js
```

### Run Functional Tests Only
```bash
node tests/plugin.test.js
```

### Run Performance Tests Only
```bash
node tests/performance.test.js
```

## Test Requirements

Before running tests, ensure:
1. Dependencies are installed: `npm install`
2. Environment is configured: copy `.env.example` to `.env`
3. Filecoin wallet has test tokens (for cloud storage tests)

## Expected Output

Successful test run will show:
```
🎯 Filecoin Cloud DWN Plugin - Complete Test Suite
==================================================

📋 Running Functional Tests...

🚀 Starting Filecoin Cloud Plugin Tests

🧪 Running test: Basic Write/Read
✅ Basic Write/Read - PASSED
🧪 Running test: JSON Write/Read
✅ JSON Write/Read - PASSED
...
🎉 All tests passed!

==================================================

📋 Running Performance Tests...

⚡ Testing write performance...
📊 Write Performance Results:
   Total time: 1234ms
   Average time per write: 123.40ms
   Writes per second: 8.10
...

==================================================
🏁 FINAL TEST RESULTS
==================================================
🎉 All functional tests PASSED!
✅ Performance tests completed successfully

🚀 The Filecoin Cloud plugin is ready for use!
```

## Test Coverage

The tests cover:
- **Data Integrity**: Ensuring data written matches data read
- **Size Handling**: Testing both small (<127 bytes) and large data
- **JSON Support**: Verifying JSON serialization/deserialization
- **Error Handling**: Testing edge cases and error conditions
- **Performance**: Measuring operation speeds and concurrency
- **Cloud Integration**: Verifying Filecoin Cloud connectivity

## Troubleshooting

### Common Test Failures

1. **"FILECOIN_PRIVATE_KEY not set"**
   - Ensure `.env` file exists with valid private key
   - Check that the wallet has test tokens

2. **Cloud upload failures**
   - Verify internet connection
   - Check RPC URL accessibility
   - Ensure sufficient USDFC tokens for storage fees

3. **Permission errors**
   - Ensure write permissions for the data directory
   - Check that the local cache path is accessible

### Debug Mode

For detailed debugging, run with environment variable:
```bash
DEBUG=* node tests/run-all-tests.js
```
