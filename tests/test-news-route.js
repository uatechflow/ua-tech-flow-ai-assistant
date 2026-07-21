const assert = require('node:assert/strict');
const express = require('express');
const newsRouter = require('../routes/news');

async function runTest() {
  const app = express();
  app.use('/api/news', newsRouter);

  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/news`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.count, payload.news.length);
    assert.ok(Array.isArray(payload.news));

    if (payload.news.length > 0) {
      const item = payload.news[0];

      assert.deepEqual(Object.keys(item), [
        'id',
        'title',
        'description',
        'content',
        'image',
        'date',
        'source',
        'tags'
      ]);
      assert.ok(Array.isArray(item.tags));
    }

    console.log('News route test passed');
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

runTest().catch((error) => {
  console.error('News route test failed:', error.message);
  process.exitCode = 1;
});
