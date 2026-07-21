const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const router = express.Router();
const CACHE_PATH = path.join(__dirname, '..', 'data', 'news-cache.json');

// GET /api/news - return the locally synchronized news cache.
router.get('/', async (req, res) => {
  try {
    const cacheContent = await fs.readFile(CACHE_PATH, 'utf8');
    const cachedNews = JSON.parse(cacheContent);

    if (!Array.isArray(cachedNews)) {
      throw new Error('News cache must contain an array');
    }

    const news = cachedNews.map((item) => ({
      id: item.id,
      title: item.title || '',
      description: item.description || item.content || '',
      content: item.content || '',
      image: item.image || item.media_source || '',
      date: item.date || item.created_at || '',
      source: item.source || item.source_url || '',
      tags: Array.isArray(item.tags) ? item.tags : []
    }));

    return res.json({
      success: true,
      count: news.length,
      news
    });
  } catch (error) {
    console.error('News cache read failed:', error.message);

    return res.status(500).json({
      success: false,
      count: 0,
      news: []
    });
  }
});

module.exports = router;
