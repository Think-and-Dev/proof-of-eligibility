import FilecoinCloudDataStore from '../plugins/plugin-filecoin-cloud.js';
import assert from 'assert';

// Simple test suite for Filecoin Cloud DWN Plugin
class FilecoinCloudPluginTests {
  constructor() {
    this.dataStore = null;
    this.testResults = [];
  }

  async setup() {
    console.log('🔧 Setting up test environment...');
    this.dataStore = new FilecoinCloudDataStore();
  }

  async teardown() {
    console.log('🧹 Cleaning up test environment...');
    // Cleanup could be added here if needed
  }

  async runTest(testName, testFunction) {
    try {
      console.log(`\n🧪 Running test: ${testName}`);
      await testFunction();
      console.log(`✅ ${testName} - PASSED`);
      this.testResults.push({ name: testName, status: 'PASSED' });
    } catch (error) {
      console.log(`❌ ${testName} - FAILED: ${error.message}`);
      this.testResults.push({ name: testName, status: 'FAILED', error: error.message });
    }
  }

  async testBasicWriteRead() {
    const testKey = `test-basic-${Date.now()}`;
    const testData = 'Hello Filecoin Cloud!';

    // Write data
    await this.dataStore.put(testKey, testData);
    
    // Read data back
    const retrievedData = await this.dataStore.get(testKey);
    
    assert.strictEqual(retrievedData, testData, 'Retrieved data should match written data');
  }

  async testJsonWriteRead() {
    const testKey = `test-json-${Date.now()}`;
    const testJson = {
      message: 'Test JSON data',
      timestamp: new Date().toISOString(),
      number: 42,
      boolean: true
    };

    // Write JSON data
    await this.dataStore.put(testKey, JSON.stringify(testJson));
    
    // Read and parse data
    const retrievedData = await this.dataStore.get(testKey);
    const parsedData = JSON.parse(retrievedData);
    
    assert.strictEqual(parsedData.message, testJson.message, 'JSON message should match');
    assert.strictEqual(parsedData.number, testJson.number, 'JSON number should match');
    assert.strictEqual(parsedData.boolean, testJson.boolean, 'JSON boolean should match');
  }

  async testLargeDataWriteRead() {
    const testKey = `test-large-${Date.now()}`;
    
    // Create data larger than 127 bytes to test padding
    const largeData = 'x'.repeat(200);
    
    // Write large data
    await this.dataStore.put(testKey, largeData);
    
    // Read data back
    const retrievedData = await this.dataStore.get(testKey);
    
    assert.strictEqual(retrievedData.length, largeData.length, 'Retrieved data length should match');
    assert.strictEqual(retrievedData, largeData, 'Retrieved data should match written data');
  }

  async testSmallDataWriteRead() {
    const testKey = `test-small-${Date.now()}`;
    
    // Create data smaller than 127 bytes to test automatic padding
    const smallData = 'Small';
    
    // Write small data
    await this.dataStore.put(testKey, smallData);
    
    // Read data back
    const retrievedData = await this.dataStore.get(testKey);
    
    assert.strictEqual(retrievedData, smallData, 'Retrieved data should match written data');
  }

  async testNonExistentKey() {
    const nonExistentKey = `non-existent-${Date.now()}`;
    
    // Try to read non-existent key
    const result = await this.dataStore.get(nonExistentKey);
    
    assert.strictEqual(result, undefined, 'Non-existent key should return undefined');
  }

  async testDeleteOperation() {
    const testKey = `test-delete-${Date.now()}`;
    const testData = 'Data to be deleted';

    // Write data
    await this.dataStore.put(testKey, testData);
    
    // Verify it exists
    const retrievedData = await this.dataStore.get(testKey);
    assert.strictEqual(retrievedData, testData, 'Data should exist before deletion');
    
    // Delete data
    await this.dataStore.delete(testKey);
    
    // Verify it's deleted
    const deletedData = await this.dataStore.get(testKey);
    assert.strictEqual(deletedData, undefined, 'Data should be deleted');
  }

  async testCloudStatus() {
    const status = await this.dataStore.getCloudStatus();
    
    assert(typeof status === 'object', 'Status should be an object');
    assert(typeof status.isEnabled === 'boolean', 'Status should include isEnabled boolean');
    assert(typeof status.isInitialized === 'boolean', 'Status should include isInitialized boolean');
  }

  async runAllTests() {
    console.log('🚀 Starting Filecoin Cloud Plugin Tests\n');

    await this.setup();

    // Run all tests
    await this.runTest('Basic Write/Read', () => this.testBasicWriteRead());
    await this.runTest('JSON Write/Read', () => this.testJsonWriteRead());
    await this.runTest('Large Data Write/Read', () => this.testLargeDataWriteRead());
    await this.runTest('Small Data Write/Read', () => this.testSmallDataWriteRead());
    await this.runTest('Non-existent Key', () => this.testNonExistentKey());
    await this.runTest('Delete Operation', () => this.testDeleteOperation());
    await this.runTest('Cloud Status Check', () => this.testCloudStatus());

    await this.teardown();

    // Print summary
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const failed = this.testResults.filter(r => r.status === 'FAILED').length;
    
    this.testResults.forEach(result => {
      const icon = result.status === 'PASSED' ? '✅' : '❌';
      console.log(`${icon} ${result.name}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log(`\n🎯 Total: ${this.testResults.length} tests`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed`);
    }
    
    return failed === 0;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new FilecoinCloudPluginTests();
  testSuite.runAllTests().catch(console.error);
}

export default FilecoinCloudPluginTests;
