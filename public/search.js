document.addEventListener('DOMContentLoaded', () => {
  // Get parameters from URL
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q') || '';
  const category = urlParams.get('category') || 'all';

  const container = document.getElementById('search-results-container');
  const queryDisplay = document.getElementById('query-display');

  if (!query) {
    container.innerHTML = '<p>Please enter a search query.</p>';
    return;
  }

  queryDisplay.textContent = query;

  // Build Boolean query for external platforms
  function formatBooleanQuery(q) {
    // Якщо є пробіли, беремо в лапки, інакше залишаємо як є
    return q.includes(' ') ? `"${q}"` : q;
  }

  const booleanQuery = formatBooleanQuery(query);

  // Визначаємо, що показувати залежно від категорії
  if (category === 'jobs') {
    renderJobs(query, booleanQuery);
  } else if (category === 'education') {
    renderCourses(booleanQuery);
  } else {
    // 'all' – за замовчуванням показуємо роботу
    renderJobs(query, booleanQuery);
  }

  // ----- Функція для роботи -----
  function renderJobs(searchQuery, boolQuery) {
    // Спочатку показуємо кнопки
    container.innerHTML = `
      <h2>Available Jobs</h2>
      <div class="external-links" style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
        <a class="button button-primary" href="https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(boolQuery)}" target="_blank">LinkedIn</a>
        <a class="button button-primary" href="https://www.indeed.com/jobs?q=${encodeURIComponent(boolQuery)}" target="_blank">Indeed</a>
        <a class="button button-primary" href="https://www.jobs.ch/en/vacancies/?term=${encodeURIComponent(boolQuery)}" target="_blank">Jobs.ch</a>
      </div>
      <div id="adzuna-results" style="margin-top:15px;">
        <p>Loading Adzuna jobs...</p>
      </div>
    `;

    // Асинхронно завантажуємо Adzuna
    requestJobs(searchQuery)
      .then(data => {
        const jobs = data.adzuna_jobs || [];
        const jobsList = document.getElementById('adzuna-results');
        if (jobs.length) {
          jobsList.innerHTML = jobs.map(job => `
            <div style="border:1px solid #ddd; padding:10px; margin:5px 0; border-radius:5px;">
              <strong>${job.title || 'Job'}</strong><br>
              ${job.company || ''}<br>
              ${job.location || ''}<br>
              ${job.url ? `<a href="${job.url}" target="_blank">Open</a>` : ''}
            </div>
          `).join('');
        } else {
          jobsList.innerHTML = '<p>No jobs found on Adzuna.</p>';
        }
      })
      .catch(error => {
        console.error('Adzuna error:', error);
        const jobsList = document.getElementById('adzuna-results');
        jobsList.innerHTML = `<p>❌ Error loading jobs: ${error.message || 'unknown error'}</p>`;
      });
  }

  // ----- Функція для курсів -----
  function renderCourses(boolQuery) {
    // Показуємо тільки кнопки, без списку курсів
    container.innerHTML = `
      <h2>Search Courses</h2>
      <div class="external-links" style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
        <a class="button button-primary" href="https://www.coursera.org/search?query=${encodeURIComponent(boolQuery)}" target="_blank">Coursera</a>
        <a class="button button-primary" href="https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(boolQuery)}" target="_blank">LinkedIn Learning</a>
        <a class="button button-primary" href="https://www.google.com/search?q=${encodeURIComponent(boolQuery)}+online+course" target="_blank">Google</a>
      </div>
    `;
    // Ми не робимо запит до Education API, бо кнопки вже є.
    // Якщо ви хочете все ж показати курси з порталу, можна додати окремий блок нижче,
    // але за умовою ми їх не показуємо.
  }

  // ----- Функції запитів до API (копіюємо з script.js) -----
  async function requestJobs(title) {
    const CAREER_API_URL = "https://job.uatechflow.org/process";
    const payload = {
      action: "search_jobs",
      title: title,
      country: "us"   // required by backend
    };

    const response = await fetch(CAREER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorBody = '';
      try { errorBody = await response.text(); } catch { errorBody = 'Unable to read error body'; }
      throw new Error(`Job search failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error("Job search returned unsuccessful response: " + JSON.stringify(data));
    }
    return data;
  }

  // Set copyright year
  document.getElementById('copyright-year').textContent = new Date().getFullYear();
});