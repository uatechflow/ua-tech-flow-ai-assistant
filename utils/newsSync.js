const fs = require('fs/promises');
const path = require('path');

const NEWS_API_URL = 'https://uatechflow.org/api/news';
const CACHE_PATH = path.join(__dirname, '..', 'data', 'news-cache.json');

// Read the existing cache, returning an empty list when it does not exist.
async function readCache() {
  try {
    const cacheContent = await fs.readFile(CACHE_PATH, 'utf8');
    const cache = JSON.parse(cacheContent);

    return Array.isArray(cache) ? cache : [];
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Unable to read the news cache:', error.message);
    }

    return [];
  }
}

// Download, merge, sort, trim, and persist the latest news items.
async function syncNews() {
  const existingNews = await readCache();
  let currentNews;

  try {
    const response = await fetch(NEWS_API_URL);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    currentNews = await response.json();

    if (!Array.isArray(currentNews)) {
      throw new Error('API response is not an array');
    }
  } catch (error) {
    console.warn('News synchronization failed:', error.message);
    return;
  }

  // Current API items replace cached items with the same id.
  const newsById = new Map(existingNews.map((item) => [item.id, item]));
  currentNews.forEach((item) => newsById.set(item.id, item));

  const latestNews = Array.from(newsById.values())
    .sort((firstItem, secondItem) => (
      new Date(secondItem.created_at).getTime() - new Date(firstItem.created_at).getTime()
    ))
    .slice(0, 6);

  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(latestNews, null, 2), 'utf8');

  return;
}

module.exports = {
  syncNews
};
