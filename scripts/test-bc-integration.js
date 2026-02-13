/**
 * Business Central Integration Test Script
 * 
 * This script helps you test your Business Central integration
 * Run with: node scripts/test-bc-integration.js
 */

require('dotenv').config();
const businessCentralService = require('../src/services/businessCentralService');
const logger = require('../src/utils/logger');

async function testBCIntegration() {
  console.log('\n🔍 Business Central Integration Test\n');
  console.log('='.repeat(50));
  
  // Test 1: Check Configuration
  console.log('\n📋 Test 1: Configuration Check');
  console.log('-'.repeat(50));
  console.log(`BC Sync Enabled: ${!businessCentralService.disabled}`);
  console.log(`API URL: ${businessCentralService.baseUrl}`);
  console.log(`Username: ${businessCentralService.authConfig.username || 'NOT SET'}`);
  console.log(`Password: ${businessCentralService.authConfig.password ? '***' + businessCentralService.authConfig.password.slice(-4) : 'NOT SET'}`);
  console.log(`Company ID: ${businessCentralService.companyId || 'AUTO-DETECT'}`);
  console.log(`Default Item ID: ${businessCentralService.defaultItemId}`);
  console.log(`Default G/L Account: ${businessCentralService.defaultGLAccount}`);
  console.log(`Max Retries: ${businessCentralService.maxRetries}`);
  console.log(`Retry Delay: ${businessCentralService.retryDelay}ms`);
  
  if (businessCentralService.disabled) {
    console.log('\n⚠️  BC Sync is DISABLED. Set DISABLE_BC_SYNC=false in .env to enable.');
    console.log('='.repeat(50));
    return;
  }
  
  // Test 2: Validate Configuration
  console.log('\n🔧 Test 2: Validate Configuration');
  console.log('-'.repeat(50));
  try {
    businessCentralService.validateConfig();
    console.log('✅ Configuration is valid');
  } catch (err) {
    console.error('❌ Configuration validation failed:', err.message);
    console.log('\n💡 Fix the configuration errors and try again.');
    console.log('='.repeat(50));
    return;
  }
  
  // Test 3: Test Connection
  console.log('\n🌐 Test 3: Test Connection to Business Central');
  console.log('-'.repeat(50));
  try {
    const result = await businessCentralService.testConnection();
    console.log('✅ Connection successful!');
    console.log(`\n🏢 Company Information:`);
    console.log(`   Company ID: ${result.companyId}`);
    
    if (result.companies && result.companies.length > 0) {
      console.log(`\n📋 Available Companies (${result.companies.length}):`);
      result.companies.forEach((company, index) => {
        console.log(`   ${index + 1}. ${company.displayName || company.name}`);
        console.log(`      ID: ${company.id}`);
      });
      
      if (result.companies.length > 1) {
        console.log(`\n💡 Multiple companies found. You can set BC_COMPANY_ID in .env to specify which one to use.`);
      }
    }
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Verify BC_USERNAME is correct');
    console.log('   2. Regenerate Web Service Access Key and update BC_PASSWORD');
    console.log('   3. Check BC_API_URL is correct for your environment');
    console.log('   4. Ensure API access is enabled in Business Central');
    console.log('\n📖 See BUSINESS_CENTRAL_SETUP.md for detailed setup instructions');
    console.log('='.repeat(50));
    return;
  }
  
  // Test 4: Get Sync Stats
  console.log('\n📊 Test 4: Sync Statistics');
  console.log('-'.repeat(50));
  try {
    const stats = await businessCentralService.getSyncStats();
    if (stats) {
      console.log(`Total Orders: ${stats.total}`);
      console.log(`✅ Synced: ${stats.synced}`);
      console.log(`⏳ Pending: ${stats.pending}`);
      console.log(`❌ Failed: ${stats.failed}`);
      console.log(`⏭️  Skipped: ${stats.skipped}`);
      
      if (stats.failed > 0) {
        console.log(`\n💡 You have ${stats.failed} failed orders. You can retry them using the manual sync endpoint.`);
      }
    } else {
      console.log('No orders found yet.');
    }
  } catch (err) {
    console.error('⚠️  Could not fetch sync stats:', err.message);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ All tests completed!');
  console.log('\n📖 Next Steps:');
  console.log('   1. Send a test email to trigger order creation');
  console.log('   2. Check logs for sync status');
  console.log('   3. Verify order appears in Business Central');
  console.log('   4. Use GET /api/orders/sync-stats to monitor sync status');
  console.log('='.repeat(50) + '\n');
  
  process.exit(0);
}

// Run the test
testBCIntegration().catch(err => {
  console.error('\n❌ Test script failed:', err);
  process.exit(1);
});
