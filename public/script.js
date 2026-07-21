document.addEventListener('DOMContentLoaded', () => {
  const CAREER_API_URL = "/api/process";
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const categorySelect = document.getElementById('category-select');
  const resultsContainer = document.getElementById('results');
  const messageElement = document.getElementById('message');
  const newsMessageElement = document.getElementById('news-message');
  const homeNewsContainer = document.getElementById('home-news');
  const newsListContainer = document.getElementById('news-list');
  const newsDetailContainer = document.getElementById('news-detail-content');
  const assistantForm = document.getElementById('assistant-form');
  const assistantInput = document.getElementById('assistant-input');
  const assistantResponse = document.getElementById('assistant-response');
  const assistantPreviewForm = document.getElementById('assistant-preview-form');
  const assistantPreviewInput = document.getElementById('assistant-preview-input');
  const assistantPreviewResponse = document.getElementById('assistant-preview-response');
  const conversationHistory = document.getElementById('conversation-history');
  const copyrightYear = document.getElementById('copyright-year');
  const viewElements = Array.from(document.querySelectorAll('[data-view]'));
  const viewButtons = Array.from(document.querySelectorAll('[data-view-target]'));

  const state = {
    currentView: 'home',
    news: [],
    newsLoaded: false
  };

  // ---- API functions ----
  async function requestCareerAssistant(resumeText) {
    const payload = {
      action: "suggest_job_titles",
      resumeText: resumeText,
      language: "en"
    };
    const response = await fetch(CAREER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Career API failed with status ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error("Career API returned unsuccessful response");
    return data;
  }

  async function requestCareerKeywords(title) {
    const payload = {
      action: "extract_keywords_for_search",
      title: title,
      language: "en"
    };
    const response = await fetch(CAREER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Career API failed with status ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error("Keyword extraction failed");
    return data;
  }

  async function requestJobs(title) {
    const payload = {
      action: "search_jobs",
      title: title,
      country: "us"
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
    if (!data.success) throw new Error("Job search returned unsuccessful response: " + JSON.stringify(data));
    return data;
  }

  async function requestCourses(query) {
    const payload = {
      action: "search_courses",
      title: query
    };
    const response = await fetch(CAREER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      let errorBody = '';
      try { errorBody = await response.text(); } catch { errorBody = 'Unable to read error body'; }
      throw new Error(`Course search failed with status ${response.status}: ${errorBody}`);
    }
    const data = await response.json();
    if (!data.success) throw new Error("Course search returned unsuccessful response: " + JSON.stringify(data));
    return data;
  }

  // ---- Helper: build checkbox HTML (max 6) ----
  function buildCheckboxHTML(items, className) {
    if (!items || items.length === 0) {
      return '<p style="font-size:0.91rem;color:#687386;margin:0;">No items found</p>';
    }
    const limited = items.slice(0, 6);
    return limited.map(item =>
      `<label class="checkbox-card"><input type="checkbox" class="${className}" value="${item}"><span>${item}</span></label>`
    ).join('');
  }

  // ---- Render assistant response ----
  function renderAssistantResponse(container, titles, skills) {
    const titlesHTML = buildCheckboxHTML(titles, 'career-path-checkbox');
    const skillsHTML = buildCheckboxHTML(skills, 'skill-checkbox');

    container.innerHTML = `
      <div class="assistant-results">
        <div class="result-section"><h3 class="section-title">Recommended Career Paths</h3><div class="checkbox-grid">${titlesHTML}</div></div>
        <div class="result-section"><h3 class="section-title">Recommended Skills</h3><div class="checkbox-grid">${skillsHTML}</div></div>
        <div class="action-buttons">
          <button id="search-selected-jobs" class="button button-primary">Search Jobs</button>
          <button id="search-selected-courses" class="button button-secondary">Search Courses</button>
        </div>
        <div id="search-results-container"></div>
      </div>
    `;

    container.querySelector('#search-selected-jobs').addEventListener('click', () => performSearch(container, 'jobs'));
    container.querySelector('#search-selected-courses').addEventListener('click', () => performSearch(container, 'courses'));
  }

  // ---- Universal search function (for assistant) ----
  async function performSearch(container, type) {
    const responseContainer = container.querySelector('#search-results-container');
    const selectedTitles = Array.from(container.querySelectorAll('.career-path-checkbox:checked')).map(cb => cb.value);
    const selectedSkills = Array.from(container.querySelectorAll('.skill-checkbox:checked')).map(cb => cb.value);

    if (selectedTitles.length === 0 && selectedSkills.length === 0) {
      alert('Please select at least one career path or skill.');
      return;
    }

    function formatTerm(term) {
      return term.includes(' ') ? `"${term}"` : term;
    }

    let booleanParts = [];
    if (selectedTitles.length) booleanParts.push('(' + selectedTitles.map(formatTerm).join(' OR ') + ')');
    if (selectedSkills.length) booleanParts.push('(' + selectedSkills.map(formatTerm).join(' OR ') + ')');
    const booleanQuery = booleanParts.join(' AND ');
    const simpleQuery = selectedTitles.slice(0,2).concat(selectedSkills.slice(0,3)).join(' ');

    if (type === 'jobs') {
      responseContainer.innerHTML = `
        <h4 style="font-size:1.04rem;margin:5.2px 0 2.6px;">Available Jobs</h4>
        <div class="external-links">
          <a class="button" href="https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(booleanQuery)}" target="_blank">LinkedIn</a>
          <a class="button" href="https://www.indeed.com/jobs?q=${encodeURIComponent(booleanQuery)}" target="_blank">Indeed</a>
          <a class="button" href="https://www.jobs.ch/en/vacancies/?term=${encodeURIComponent(booleanQuery)}" target="_blank">Jobs.ch</a>
        </div>
        <ul class="job-list" id="adzuna-list"><li class="job-item">Loading Adzuna jobs...</li></ul>
      `;
      try {
        const jobsData = await requestJobs(simpleQuery);
        const jobs = jobsData.adzuna_jobs || [];
        const list = document.getElementById('adzuna-list');
        list.innerHTML = jobs.length ? jobs.map(j => `
          <li class="job-item"><strong>${j.title||'Job'}</strong>${j.company?`<span>${j.company}</span>`:''}${j.location?`<span>${j.location}</span>`:''}${j.url?`<a href="${j.url}" target="_blank">Open</a>`:''}</li>
        `).join('') : '<li class="job-item">No jobs found on Adzuna</li>';
      } catch(e) {
        document.getElementById('adzuna-list').innerHTML = `<li class="job-item">❌ Error: ${e.message}</li>`;
      }
    } else {
      responseContainer.innerHTML = `
        <h4 style="font-size:1.04rem;margin:5.2px 0 2.6px;">Search Courses</h4>
        <div class="external-links">
          <a class="button" href="https://www.coursera.org/search?query=${encodeURIComponent(booleanQuery)}" target="_blank">Coursera</a>
          <a class="button" href="https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(booleanQuery)}" target="_blank">LinkedIn Learning</a>
          <a class="button" href="https://www.edx.org/search?q=${encodeURIComponent(booleanQuery)}" target="_blank">edX</a>
        </div>
        <p style="margin:2.6px 0 0;color:#687386;font-size:0.91rem;">Click buttons above to search on external platforms.</p>
      `;
    }
  }

  // ---- Quick Search (header) ----
  async function quickSearch(query, category) {
    resultsContainer.innerHTML = '';
    messageElement.hidden = true;
    const fmt = t => t.includes(' ') ? `"${t}"` : t;
    const booleanQuery = fmt(query);

    if (category === 'jobs' || category === 'all') {
      const jobsSection = document.createElement('div');
      jobsSection.className = 'assistant-results';
      jobsSection.style.marginBottom = category === 'all' ? '12px' : '0';
      jobsSection.innerHTML = `
        <div class="result-section">
          <h3 class="section-title" style="font-size:1.04rem;margin:0 0 4px 0;">Available Jobs</h3>
          <div class="external-links">
            <a class="button" href="https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(booleanQuery)}" target="_blank">LinkedIn</a>
            <a class="button" href="https://www.indeed.com/jobs?q=${encodeURIComponent(booleanQuery)}" target="_blank">Indeed</a>
            <a class="button" href="https://www.jobs.ch/en/vacancies/?term=${encodeURIComponent(booleanQuery)}" target="_blank">Jobs.ch</a>
          </div>
          <ul class="job-list" id="adzuna-list-quick"><li class="job-item">Loading Adzuna jobs...</li></ul>
        </div>
      `;
      resultsContainer.appendChild(jobsSection);
      try {
        const jobsData = await requestJobs(query);
        const jobs = jobsData.adzuna_jobs || [];
        const list = document.getElementById('adzuna-list-quick');
        list.innerHTML = jobs.length ? jobs.map(j => `
          <li class="job-item"><strong>${j.title||'Job'}</strong>${j.company?`<span>${j.company}</span>`:''}${j.location?`<span>${j.location}</span>`:''}${j.url?`<a href="${j.url}" target="_blank">Open</a>`:''}</li>
        `).join('') : '<li class="job-item">No jobs found on Adzuna</li>';
      } catch(e) {
        document.getElementById('adzuna-list-quick').innerHTML = `<li class="job-item">❌ Error: ${e.message}</li>`;
      }
    }

    if (category === 'education' || category === 'all') {
      const coursesSection = document.createElement('div');
      coursesSection.className = 'assistant-results';
      coursesSection.innerHTML = `
        <div class="result-section">
          <h3 class="section-title" style="font-size:1.04rem;margin:0 0 4px 0;">Search Courses</h3>
          <div class="external-links">
            <a class="button" href="https://www.coursera.org/search?query=${encodeURIComponent(booleanQuery)}" target="_blank">Coursera</a>
            <a class="button" href="https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(booleanQuery)}" target="_blank">LinkedIn Learning</a>
            <a class="button" href="https://www.edx.org/search?q=${encodeURIComponent(booleanQuery)}" target="_blank">edX</a>
          </div>
          <p style="margin:4px 0 0;color:#687386;font-size:0.91rem;">Click buttons above to search on external platforms.</p>
        </div>
      `;
      resultsContainer.appendChild(coursesSection);
    }
  }

  // ---- News service ----
  const newsService = {
    async getNews() {
      const response = await fetch('/api/news');
      if (!response.ok) throw new Error(`News request failed with status ${response.status}`);
      const payload = await response.json();
      if (!payload.success || !Array.isArray(payload.news)) {
        throw new Error('News response does not contain a valid news array');
      }
      return payload.news;
    }
  };

  // ---- View management ----
  function showView(viewName) {
    viewElements.forEach(view => { view.hidden = view.dataset.view !== viewName; });
    state.currentView = viewName;
    if (viewName === 'home' || viewName === 'news') loadNews();
  }

  function navigateTo(viewName, replace = false) {
    const historyState = { view: viewName };
    const url = viewName === 'home' ? window.location.pathname : `#${viewName}`;
    if (replace) {
      window.history.replaceState(historyState, '', url);
    } else {
      window.history.pushState(historyState, '', url);
    }
    showView(viewName);
  }

  // ---- Search (main) ----
  function clearResults() { resultsContainer.replaceChildren(); }

  function showMessage(msg) {
    messageElement.textContent = msg;
    messageElement.hidden = !msg;
  }

  function showLoading() { showMessage('Searching...'); }

  function truncateDescription(text, maxLength) {
    const desc = String(text || '');
    return desc.length <= maxLength ? desc : desc.slice(0, maxLength - 3) + '...';
  }

  function renderResults(results) {
    if (!Array.isArray(results) || results.length === 0) {
      showMessage('No results found.');
      return;
    }
    const heading = document.createElement('h2');
    heading.textContent = `Found ${results.length} results`;
    resultsContainer.appendChild(heading);
    results.forEach(result => {
      const card = document.createElement('article');
      card.className = 'result-card';
      const title = document.createElement('h3');
      title.textContent = result.title || 'Untitled opportunity';
      card.appendChild(title);
      const desc = document.createElement('p');
      desc.textContent = truncateDescription(result.description, 200);
      card.appendChild(desc);
      const details = document.createElement('dl');
      [
        ['Source', result.source && result.source.name],
        ['Category', result.category],
        ['Location', result.location],
        ['Company', result.company],
        ['Provider', result.provider]
      ].forEach(([label, value]) => {
        if (!value) return;
        const dt = document.createElement('dt');
        dt.textContent = label;
        details.appendChild(dt);
        const dd = document.createElement('dd');
        dd.textContent = value;
        details.appendChild(dd);
      });
      card.appendChild(details);
      if (result.url) {
        const link = document.createElement('a');
        link.className = 'result-link';
        link.href = result.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Open';
        card.appendChild(link);
      }
      resultsContainer.appendChild(card);
    });
  }

  // ---- News rendering ----
  function formatDate(dateValue) {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function getMediaUrl(mediaSource) {
    if (!mediaSource) return '';
    try { return new URL(mediaSource, window.location.origin).href; } catch { return ''; }
  }

  function createNewsImage(newsItem) {
    const img = document.createElement('img');
    img.src = getMediaUrl(newsItem.media_source);
    img.alt = newsItem.title || 'News image';
    img.loading = 'lazy';
    img.addEventListener('error', () => { img.hidden = true; });
    return img;
  }

  function createNewsTags(newsItem) {
    const tags = document.createElement('div');
    tags.className = 'news-tags';
    let tagValues = [];
    if (typeof newsItem.tags === 'string') {
      tagValues = newsItem.tags.split(',').map(t => t.trim()).filter(Boolean);
    } else if (Array.isArray(newsItem.tags)) {
      tagValues = newsItem.tags;
    }
    tagValues.forEach(tagValue => {
      const tag = document.createElement('span');
      tag.className = 'news-tag';
      tag.textContent = tagValue;
      tags.appendChild(tag);
    });
    return tags;
  }

  function createNewsCard(newsItem, expanded = false) {
    const card = document.createElement('article');
    card.className = 'news-card';
    card.appendChild(createNewsImage(newsItem));

    const title = document.createElement('h2');
    title.textContent = newsItem.title || 'Untitled news';
    card.appendChild(title);

    const date = document.createElement('time');
    date.dateTime = newsItem.created_at || '';
    date.textContent = formatDate(newsItem.created_at);
    card.appendChild(date);

    const description = document.createElement('p');
    const content = newsItem.content || '';
    description.textContent = expanded ? content : truncateDescription(content, 160);
    card.appendChild(description);

    if (expanded) {
      const source = document.createElement('p');
      source.className = 'news-source';
      source.textContent = newsItem.source_url || 'Source unavailable';
      card.appendChild(source);
      card.appendChild(createNewsTags(newsItem));
    }

    const readMore = document.createElement('button');
    readMore.className = 'button button-secondary';
    readMore.type = 'button';
    readMore.textContent = 'Read more';
    readMore.addEventListener('click', () => showNewsDetail(newsItem));
    card.appendChild(readMore);

    return card;
  }

  function renderNewsCollection(container, newsItems, expanded = false) {
    container.replaceChildren();
    newsItems.forEach((newsItem) => {
      container.appendChild(createNewsCard(newsItem, expanded));
    });
  }

  function showNewsMessage(msg) {
    newsMessageElement.textContent = msg;
    newsMessageElement.hidden = !msg;
  }

  async function loadNews() {
    if (state.newsLoaded) return;
    showNewsMessage('Loading news...');
    try {
      state.news = await newsService.getNews();
      state.newsLoaded = true;
      showNewsMessage('');
      renderNewsCollection(homeNewsContainer, state.news.slice(0, 3));
      renderNewsCollection(newsListContainer, state.news.slice(0, 6), true);
    } catch (error) {
      console.error('News error:', error);
      showNewsMessage('News is currently unavailable. Please try again later.');
    }
  }

  function showNewsDetail(newsItem) {
    newsDetailContainer.replaceChildren();
    newsDetailContainer.appendChild(createNewsImage(newsItem));

    const title = document.createElement('h1');
    title.textContent = newsItem.title || 'Untitled news';
    newsDetailContainer.appendChild(title);

    const date = document.createElement('time');
    date.dateTime = newsItem.created_at || '';
    date.textContent = formatDate(newsItem.created_at);
    newsDetailContainer.appendChild(date);

    const content = document.createElement('p');
    content.textContent = newsItem.content || '';
    newsDetailContainer.appendChild(content);

    const source = document.createElement('p');
    source.className = 'news-source';
    source.textContent = `Source: ${newsItem.source_url || 'Unavailable'}`;
    newsDetailContainer.appendChild(source);
    newsDetailContainer.appendChild(createNewsTags(newsItem));

    navigateTo('news-detail');
  }

  // ---- Conversation history ----
  function addConversationMessage(label, text) {
    const item = document.createElement('article');
    item.className = 'conversation-item';
    const heading = document.createElement('strong');
    heading.textContent = label;
    item.appendChild(heading);
    const msg = document.createElement('p');
    msg.textContent = text;
    item.appendChild(msg);
    conversationHistory.appendChild(item);
  }

  // ---- Event listeners ----
  viewButtons.forEach(button => {
    button.addEventListener('click', () => navigateTo(button.dataset.viewTarget));
  });

  window.addEventListener('popstate', () => {
    const viewName = window.history.state && window.history.state.view
      ? window.history.state.view
      : 'home';
    showView(viewName);
  });

  // Main search form
  searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    const category = categorySelect.value;
    clearResults();
    navigateTo('results');
    if (!query) { showMessage('Please enter a search query.'); return; }
    showLoading();
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`);
      if (!response.ok) { showMessage('Search failed. Please try again.'); return; }
      const data = await response.json();
      if (data.success === false || data.count === 0) { showMessage('No results found.'); return; }
      showMessage('');
      renderResults(Array.isArray(data.results) ? data.results : []);
    } catch (error) {
      showMessage('Unable to connect to the server. Please check your connection.');
    }
  });

  // Full AI Career Assistant
  assistantForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const profile = assistantInput.value.trim();
    if (!profile) { assistantResponse.textContent = 'Please enter your profile.'; return; }
    assistantResponse.textContent = 'Analyzing your career opportunities...';
    try {
      const data = await requestCareerAssistant(profile);
      const titles = data.suggested_titles || [];
      if (titles.length === 0) { assistantResponse.textContent = 'No career recommendations found.'; return; }
      const skillsData = await requestCareerKeywords(titles[0]);
      const skills = skillsData.search_keywords || [];
      assistantResponse.innerHTML = '';
      renderAssistantResponse(assistantResponse, titles, skills);
    } catch (error) {
      console.error(error);
      assistantResponse.textContent = 'Career Assistant is currently unavailable.';
    }
  });

  // Home preview AI Assistant
  assistantPreviewForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const profile = assistantPreviewInput.value.trim();
    if (!profile) { assistantPreviewResponse.textContent = 'Please enter your profile.'; return; }
    assistantPreviewResponse.textContent = 'Analyzing your career opportunities...';
    try {
      const data = await requestCareerAssistant(profile);
      const titles = data.suggested_titles || [];
      if (titles.length === 0) { assistantPreviewResponse.textContent = 'No career recommendations found.'; return; }
      const skillsData = await requestCareerKeywords(titles[0]);
      const skills = skillsData.search_keywords || [];
      assistantPreviewResponse.innerHTML = '';
      renderAssistantResponse(assistantPreviewResponse, titles, skills);
    } catch (error) {
      console.error(error);
      assistantPreviewResponse.textContent = 'Career Assistant is currently unavailable.';
    }
  });

  // ---- Misc ----
  document.querySelectorAll('[data-placeholder-link="true"]').forEach(link => {
    link.addEventListener('click', (event) => event.preventDefault());
  });

  copyrightYear.textContent = new Date().getFullYear();

  const validViews = new Set(viewElements.map(view => view.dataset.view));
  const requestedView = window.location.hash.slice(1);
  const initialView = validViews.has(requestedView) ? requestedView : 'home';
  navigateTo(initialView, true);
});