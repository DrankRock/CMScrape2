// Quick test script to verify scraper works
const { Scraper } = require('./src/scraper.js');

console.log('🧪 Testing Scraper Setup...\n');

// Test configuration
const config = {
  urlsContent: 'https://www.cardmarket.com/en/Magic',
  xpathsContent: 'Test Field|/html/body/header/h1',
  autoDetectMode: false,
  outputDir: './test_output',
  minDelay: 3000,
  maxDelay: 5000,
  showChrome: true,
  enableWarmup: false, // Disable warmup for quick test
  usePersistentProfile: true,
};

// Event handler
function eventHandler({ type, data }) {
  console.log(`[${type}]`, data);
}

async function test() {
  try {
    console.log('Creating scraper instance...');
    const scraper = new Scraper(config, eventHandler);

    console.log('\n✅ Scraper created successfully!');
    console.log('📊 Status:');
    console.log(`   - Profiles available: ${scraper.availableProfiles.length}`);
    console.log(`   - URLs to scrape: ${scraper.urls.length}`);
    console.log(`   - XPath fields: ${scraper.xpathFields.length}`);

    console.log('\n🌐 Creating Hero browser...');
    await scraper.createHero();

    console.log('\n✅ Browser created successfully!');
    console.log(`   - Profile: ${scraper.currentProfilePath || 'Temporary'}`);
    console.log(`   - User Agent: ${scraper.currentUserAgent.substring(0, 80)}...`);
    console.log(`   - Locale: ${scraper.currentLocale}`);
    console.log(`   - Timezone: ${scraper.currentTimezone}`);

    console.log('\n🧪 Testing navigation...');
    await scraper.hero.goto('https://www.cardmarket.com', { timeoutMs: 30000 });
    const title = await scraper.hero.document.title;

    console.log(`\n✅ Navigation successful!`);
    console.log(`   - Page title: ${title}`);

    console.log('\n🧹 Cleaning up...');
    await scraper.close();

    console.log('\n✅ All tests passed!\n');
    console.log('Your scraper is ready to use. 🚀\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed!');
    console.error(`Error: ${error.message}`);
    console.error('\nStack trace:');
    console.error(error.stack);

    console.error('\n💡 Troubleshooting:');
    if (error.message.includes('profile')) {
      console.error('   - Run: setup-profiles.bat');
      console.error('   - Or set usePersistentProfile: false in config');
    } else if (error.message.includes('timeout')) {
      console.error('   - Check your internet connection');
      console.error('   - Try increasing timeout');
    } else {
      console.error('   - Check the error message above');
      console.error('   - Make sure Chrome is installed');
      console.error('   - Make sure all dependencies are installed (npm install)');
    }

    process.exit(1);
  }
}

// Run test
test();
