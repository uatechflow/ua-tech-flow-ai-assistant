const fs = require('fs/promises');
const path = require('path');

const { syncNews } = require('../utils/newsSync');

const CACHE_PATH = path.join(__dirname, '..', 'data', 'news-cache.json');

async function runTest() {
  console.log('=================================');
  console.log('UA TECH FLOW NEWS SYNC TEST');
  console.log('=================================');

  try {
    console.log('\nRunning news synchronization...');

    await syncNews();

    console.log('SYNC FUNCTION COMPLETED');

    const cacheContent = await fs.readFile(CACHE_PATH, 'utf8');
    const news = JSON.parse(cacheContent);

    console.log('\nCache file found:');
    console.log(CACHE_PATH);

    console.log('\nItems in cache:', news.length);

    console.log('\nLatest news:');
    console.log('---------------------------------');

    news.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
      console.log(`ID: ${item.id}`);
      console.log(`Date: ${item.created_at}`);
      console.log(`Image: ${item.media_source || 'none'}`);
      console.log('---------------------------------');
    });

    // Validation
    if (!Array.isArray(news)) {
      throw new Error('Cache is not an array');
    }

    if (news.length > 6) {
      throw new Error('Cache contains more than 6 news items');
    }

    if (news.length > 0) {
      if (!news[0].id || !news[0].title || !news[0].created_at) {
        throw new Error('News item structure is invalid');
      }
    }

    console.log('\n✅ NEWS SYNC TEST PASSED');
    console.log('=================================');

  } catch (error) {
    console.error('\n❌ NEWS SYNC TEST FAILED');
    console.error(error.message);
    process.exit(1);
  }
}

runTest();