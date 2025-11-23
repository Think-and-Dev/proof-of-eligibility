import FilecoinCloudDataStore from '../plugins/plugin-filecoin-cloud.js';

// Simple performance test for Filecoin Cloud DWN Plugin
class PerformanceTests {
  constructor() {
    this.dataStore = null;
  }

  async setup() {
    console.log('🔧 Setting up performance test environment...');
    this.dataStore = new FilecoinCloudDataStore();
  }

  async testWritePerformance() {
    console.log('\n⚡ Testing write performance...');
    
    const iterations = 10;
    const testData = 'Performance test data - '.repeat(10); // ~300 bytes
    
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      const key = `perf-write-${i}-${Date.now()}`;
      await this.dataStore.put(key, testData);
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;
    
    console.log(`📊 Write Performance Results:`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Average time per write: ${avgTime.toFixed(2)}ms`);
    console.log(`   Writes per second: ${(1000 / avgTime).toFixed(2)}`);
    
    return { totalTime, avgTime, writesPerSecond: 1000 / avgTime };
  }

  async testReadPerformance() {
    console.log('\n⚡ Testing read performance...');
    
    const iterations = 10;
    const testData = 'Performance test data - '.repeat(10);
    const keys = [];
    
    // First, write test data
    for (let i = 0; i < iterations; i++) {
      const key = `perf-read-${i}-${Date.now()}`;
      await this.dataStore.put(key, testData);
      keys.push(key);
    }
    
    // Now test reads
    const startTime = Date.now();
    
    for (const key of keys) {
      await this.dataStore.get(key);
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;
    
    console.log(`📊 Read Performance Results:`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Average time per read: ${avgTime.toFixed(2)}ms`);
    console.log(`   Reads per second: ${(1000 / avgTime).toFixed(2)}`);
    
    return { totalTime, avgTime, readsPerSecond: 1000 / avgTime };
  }

  async testConcurrentOperations() {
    console.log('\n⚡ Testing concurrent operations...');
    
    const concurrentWrites = 5;
    const testData = 'Concurrent test data';
    
    const startTime = Date.now();
    
    // Create multiple write promises
    const writePromises = [];
    for (let i = 0; i < concurrentWrites; i++) {
      const key = `concurrent-${i}-${Date.now()}`;
      writePromises.push(this.dataStore.put(key, testData));
    }
    
    // Execute all writes concurrently
    await Promise.all(writePromises);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log(`📊 Concurrent Write Results:`);
    console.log(`   ${concurrentWrites} concurrent writes completed in: ${totalTime}ms`);
    console.log(`   Average time per concurrent write: ${(totalTime / concurrentWrites).toFixed(2)}ms`);
    
    return { totalTime, concurrentWrites };
  }

  async runAllPerformanceTests() {
    console.log('🚀 Starting Filecoin Cloud Plugin Performance Tests\n');

    await this.setup();

    const writeResults = await this.testWritePerformance();
    const readResults = await this.testReadPerformance();
    const concurrentResults = await this.testConcurrentOperations();

    console.log('\n📊 Performance Test Summary:');
    console.log('============================');
    console.log(`✅ Write Performance: ${writeResults.writesPerSecond.toFixed(2)} writes/sec`);
    console.log(`✅ Read Performance: ${readResults.readsPerSecond.toFixed(2)} reads/sec`);
    console.log(`✅ Concurrent Operations: ${concurrentResults.concurrentWrites} writes in ${concurrentResults.totalTime}ms`);
    
    return { writeResults, readResults, concurrentResults };
  }
}

// Run performance tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const perfTests = new PerformanceTests();
  perfTests.runAllPerformanceTests().catch(console.error);
}

export default PerformanceTests;
