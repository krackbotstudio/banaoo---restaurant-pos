// Simple test script to verify Pexels API is working
// Run with: node test-pexels.js

import 'dotenv/config';

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

async function testPexelsAPI() {
  console.log('\n🔍 Testing Pexels API Integration\n');
  console.log('─'.repeat(50));

  // Check if API key is configured
  if (!PEXELS_API_KEY) {
    console.error('❌ PEXELS_API_KEY is not configured in .env');
    console.log('\nAdd this to your server/.env file:');
    console.log('PEXELS_API_KEY=your_api_key_here');
    process.exit(1);
  }

  console.log('✅ PEXELS_API_KEY is configured');
  console.log(`   Key: ${PEXELS_API_KEY.substring(0, 8)}...${PEXELS_API_KEY.slice(-4)}`);

  // Test API call
  const testQuery = 'butter chicken food dish';
  console.log(`\n📸 Searching for: "${testQuery}"`);

  try {
    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.set('query', testQuery);
    url.searchParams.set('per_page', '5');
    url.searchParams.set('orientation', 'landscape');

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': PEXELS_API_KEY }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\n❌ API Error: ${response.status} ${response.statusText}`);
      console.error(`   Response: ${errorText}`);
      
      if (response.status === 401) {
        console.log('\n💡 Tip: Check if your API key is valid at https://www.pexels.com/api/');
      }
      process.exit(1);
    }

    const data = await response.json();
    
    console.log(`\n✅ API Response OK`);
    console.log(`   Total results: ${data.total_results}`);
    console.log(`   Photos returned: ${data.photos?.length || 0}`);

    if (data.photos && data.photos.length > 0) {
      console.log('\n📷 Sample photos:');
      data.photos.slice(0, 3).forEach((photo, i) => {
        console.log(`\n   ${i + 1}. ${photo.alt || 'No description'}`);
        console.log(`      Photographer: ${photo.photographer}`);
        console.log(`      Large: ${photo.src.large}`);
        console.log(`      Medium: ${photo.src.medium}`);
      });

      console.log('\n' + '─'.repeat(50));
      console.log('✅ Pexels API is working correctly!\n');
    } else {
      console.log('\n⚠️  No photos found for this query (API works but no results)');
    }

  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    process.exit(1);
  }
}

testPexelsAPI();
