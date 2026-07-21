// worker.js – Cloudflare Worker for UA TECH FLOW AI Assistant
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/api/')) {
      return handleApi(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (path === '/api/search') {
    const query = url.searchParams.get('q') || '';
    const category = url.searchParams.get('category') || 'all';
    return handleSearch(query, category);
  }

  if (path === '/api/news') {
    return handleNews();
  }

  if (path === '/api/process' && request.method === 'POST') {
    return handleProcess(request);
  }

  if (path === '/api/health') {
    return jsonResponse({ success: true, message: 'Worker is running' });
  }

  return new Response('Not found', { status: 404 });
}

// ---- Проксі до job.uatechflow.org/process ----
async function handleProcess(request) {
  try {
    const body = await request.json();
    const resp = await fetch('https://job.uatechflow.org/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    return jsonResponse(data, resp.status);
  } catch (e) {
    return jsonResponse({ success: false, error: e.message }, 500);
  }
}

// ---- Агрегація пошуку (jobs + education) ----
async function handleSearch(query, category) {
  const normalizedQuery = query.trim().toLowerCase();
  const results = [];

  async function fetchJobs() {
    const payload = { action: 'search_jobs', title: query || 'developer', country: 'Switzerland', language: 'en' };
    try {
      const resp = await fetch('https://job.uatechflow.org/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      const jobs = data.adzuna_jobs || [];
      return jobs.map(job => ({
        title: job.title,
        description: job.description || '',
        url: job.url,
        category: 'job',
        source: { id: 'job', name: 'UA TECH FLOW Jobs' },
        company: job.company,
        location: job.location
      }));
    } catch { return []; }
  }

  async function fetchEducation() {
    const types = ['lehre', 'course'];
    const allItems = [];
    for (const type of types) {
      try {
        const resp = await fetch(`https://edu.uatechflow.org/api/opportunities?type=${type}`);
        if (!resp.ok) continue;
        const data = await resp.json();
        const items = data.items || [];
        items.forEach(item => {
          allItems.push({
            title: item.title_de || item.title_uk,
            description: item.description_de || item.description_uk || '',
            url: item.website || `https://edu.uatechflow.org/opportunities/${item.id}`,
            category: item.type,
            source: { id: 'edu', name: 'UA TECH FLOW Education' },
            provider: item.provider_de || item.provider_uk,
            location: item.location,
            searchText: [item.title_de, item.title_uk, item.description_de, item.description_uk, item.provider_de, item.provider_uk, item.location].filter(Boolean).join(' ')
          });
        });
      } catch { /* ignore */ }
    }
    return allItems;
  }

  let jobResults = [], eduResults = [];
  if (category === 'jobs' || category === 'all') jobResults = await fetchJobs();
  if (category === 'education' || category === 'all') eduResults = await fetchEducation();

  const merged = [...jobResults, ...eduResults];
  let filtered = merged;
  if (normalizedQuery) {
    filtered = merged.filter(item => {
      const searchText = [item.title, item.description, item.company, item.provider, item.searchText].filter(Boolean).join(' ').toLowerCase();
      return searchText.includes(normalizedQuery);
    });
  }

  return jsonResponse({ success: true, count: filtered.length, results: filtered });
}

// ---- Новини ----
async function handleNews() {
  try {
    const resp = await fetch('https://uatechflow.org/api/news');
    if (!resp.ok) throw new Error('News fetch failed');
    const data = await resp.json();
    return jsonResponse({ success: true, news: Array.isArray(data) ? data : [] });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

// ---- JSON відповідь з CORS ----
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}