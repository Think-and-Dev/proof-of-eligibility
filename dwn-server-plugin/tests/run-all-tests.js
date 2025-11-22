import FilecoinCloudPluginTests from './plugin.test.js';
import PerformanceTests from './performance.test.js';

// Test runner for all Filecoin Cloud plugin tests
class TestRunner {
  static async runAllTests() {
    console.log('🎯 Filecoin Cloud DWN Plugin - Complete Test Suite');
    console.log('==================================================\n');

    let allPassed = true;

    try {
      // Run functional tests
      console.log('📋 Running Functional Tests...\n');
      const functionalTests = new FilecoinCloudPluginTests();
      const functionalPassed = await functionalTests.runAllTests();
      allPassed = allPassed && functionalPassed;

      console.log('\n' + '='.repeat(50) + '\n');

      // Run performance tests
      console.log('📋 Running Performance Tests...\n');
      const performanceTests = new PerformanceTests();
      await performanceTests.runAllPerformanceTests();

      console.log('\n' + '='.repeat(50));
      console.log('🏁 FINAL TEST RESULTS');
      console.log('='.repeat(50));
      
      if (allPassed) {
        console.log('🎉 All functional tests PASSED!');
        console.log('✅ Performance tests completed successfully');
        console.log('\n🚀 The Filecoin Cloud plugin is ready for use!');
      } else {
        console.log('❌ Some functional tests FAILED');
        console.log('⚠️  Please check the errors above before using the plugin');
      }

    } catch (error) {
      console.error('💥 Test runner failed:', error);
      allPassed = false;
    }

    return allPassed;
  }
}

// Run all tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  TestRunner.runAllTests().catch(console.error);
}

export default TestRunner;
