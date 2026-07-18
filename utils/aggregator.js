const JOBS_API_URL = 'https://job.uatechflow.org/process';
const EDUCATION_API_URL = 'https://edu.uatechflow.org/api/opportunities';

// Fetch JSON and treat non-success responses as API failures.
async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch and merge job and education resources into a common result format.
 * @param {string} query Search keyword.
 * @param {'all'|'education'|'jobs'} category Resource category.
 * @returns {Promise<Array<object>>} Merged and filtered resources.
 */
async function aggregateResources(query, category) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const jobResultsPromise = category === 'all' || category === 'jobs'
    ? fetchJson(JOBS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search_jobs',
          title: query || 'developer',
          country: 'Switzerland',
          language: 'en'
        })
      })
        .then((data) => (Array.isArray(data.adzuna_jobs) ? data.adzuna_jobs : []))
        .then((jobs) => jobs.map((job) => ({
          title: job.title,
          description: job.description || '',
          url: job.url,
          category: 'job',
          source: { id: 'job', name: 'UA TECH FLOW Jobs' },
          company: job.company,
          location: job.location
        })))
        .catch((error) => {
          console.warn('Job API request failed:', error.message);
          return [];
        })
    : Promise.resolve([]);

  const educationPromises = category === 'all' || category === 'education'
    ? ['lehre', 'course'].map((type) => fetchJson(`${EDUCATION_API_URL}?type=${type}`)
        .then((data) => (Array.isArray(data.items) ? data.items : []))
        .then((items) => items.map((item) => ({
          title: item.title_de || item.title_uk,
          description: item.description_de || item.description_uk || '',
          url: item.website || `https://edu.uatechflow.org/opportunities/${item.id}`,
          category: item.type,
          source: { id: 'edu', name: 'UA TECH FLOW Education' },
          provider: item.provider_de || item.provider_uk,
          location: item.location,
          searchText: [
            item.title_de,
            item.title_uk,
            item.description_de,
            item.description_uk,
            item.provider_de,
            item.provider_uk,
            item.location
          ]
            .filter(Boolean)
            .join(' ')
        })))
        .catch((error) => {
          console.warn(`Education API request failed for type ${type}:`, error.message);
          return [];
        }))
    : [];

  const [jobResults, educationResults] = await Promise.all([
    jobResultsPromise,
    Promise.all(educationPromises).then((results) => results.flat())
  ]);

  const mergedResults = [...jobResults, ...educationResults];

  if (!normalizedQuery) {
    return mergedResults;
  }

  return mergedResults.filter((resource) =>
    [
      resource.title,
      resource.description,
      resource.company,
      resource.provider,
      resource.searchText
    ].some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(normalizedQuery)
    )
  );
}

module.exports = { aggregateResources };
