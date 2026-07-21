document.addEventListener('DOMContentLoaded', () => {
  const CAREER_API_URL = "https://job.uatechflow.org/process";
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

  async function requestCareerAssistant(resumeText) {
    const payload = {
      action: "suggest_job_titles",
      resumeText: resumeText,
      language: "en"
    };

    const response = await fetch(CAREER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Career API failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error("Career API returned unsuccessful response");
    }

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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Career API failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error("Keyword extraction failed");
    }

    return data;
  }

  async function requestJobs(title) {
    const payload = {
      action: "search_jobs",
      title: title
    };

    const response = await fetch(CAREER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Unable to read error body';
      }
      throw new Error(`Job search failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error("Job search returned unsuccessful response: " + JSON.stringify(data));
    }

    return data;
  }

  async function requestCourses(query) {
    const payload = {
      action: "search_courses",
      title: query
    };

    const response = await fetch(CAREER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Unable to read error body';
      }
      throw new Error(`Course search failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error("Course search returned unsuccessful response: " + JSON.stringify(data));
    }

    return data;
  }

  // Keep all news requests behind one backend-facing adapter.
  const newsService = {
    async getNews() {
      const response = await fetch('/api/news');

      if (!response.ok) {
        throw new Error(`News request failed with status ${response.status}`);
      }

      const payload = await response.json();

      if (!payload.success || !Array.isArray(payload.news)) {
        throw new Error('News response does not contain a valid news array');
      }

      return payload.news;
    }
  };

  // Switch between internal views without leaving the application.
  function showView(viewName) {
    viewElements.forEach((view) => {
      view.hidden = view.dataset.view !== viewName;
    });

    state.currentView = viewName;

    if (viewName === 'home') {
      loadNews();
    }

    if (viewName === 'news') {
      loadNews();
    }
  }

  // Change views while preserving browser Back and Forward behavior.
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

  // Remove all previously rendered search results.
  function clearResults() {
    resultsContainer.replaceChildren();
  }

  // Display a status message for the current search state.
  function showMessage(message) {
    messageElement.textContent = message;
    messageElement.hidden = !message;
  }

  // Display the loading state while the API request is in progress.
  function showLoading() {
    showMessage('Searching...');
  }

  // Keep descriptions readable while preserving complete result cards.
  function truncateDescription(text, maxLength) {
    const description = String(text || '');

    if (description.length <= maxLength) {
      return description;
    }

    return `${description.slice(0, maxLength - 3)}...`;
  }

  // Render each search result using semantic DOM elements.
  function renderResults(results) {
    const heading = document.createElement('h2');
    heading.textContent = `Found ${results.length} results`;
    resultsContainer.appendChild(heading);

    results.forEach((result) => {
      const card = document.createElement('article');
      card.className = 'result-card';

      const title = document.createElement('h3');
      title.textContent = result.title || 'Untitled opportunity';
      card.appendChild(title);

      const description = document.createElement('p');
      description.textContent = truncateDescription(result.description, 200);
      card.appendChild(description);

      const details = document.createElement('dl');
      const detailsToRender = [
        ['Source', result.source && result.source.name],
        ['Category', result.category],
        ['Location', result.location],
        ['Company', result.company],
        ['Provider', result.provider]
      ];

      detailsToRender.forEach(([label, value]) => {
        if (!value) {
          return;
        }

        const term = document.createElement('dt');
        term.textContent = label;
        details.appendChild(term);

        const definition = document.createElement('dd');
        definition.textContent = value;
        details.appendChild(definition);
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

  // Format API dates consistently for cards and detail pages.
  function formatDate(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return 'Date unavailable';
    }

    return new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  // Resolve relative media paths without requesting the news API directly.
  function getMediaUrl(mediaSource) {
    if (!mediaSource) {
      return '';
    }

    try {
      return new URL(mediaSource, window.location.origin).href;
    } catch (error) {
      return '';
    }
  }

  function createNewsImage(newsItem) {
    const image = document.createElement('img');
    image.src = getMediaUrl(newsItem.media_source);
    image.alt = newsItem.title || 'News image';
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      image.hidden = true;
    });
    return image;
  }

  function createNewsTags(newsItem) {
    const tags = document.createElement('div');
    tags.className = 'news-tags';
    const tagValues = Array.isArray(newsItem.tags) ? newsItem.tags : [];

    tagValues.forEach((tagValue) => {
      const tag = document.createElement('span');
      tag.className = 'news-tag';
      tag.textContent = tagValue;
      tags.appendChild(tag);
    });

    return tags;
  }

  // Create a compact card for home and the full news listing.
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
    description.textContent = expanded
      ? newsItem.content || ''
      : truncateDescription(newsItem.content, 160);
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

  function showNewsMessage(message) {
    newsMessageElement.textContent = message;
    newsMessageElement.hidden = !message;
  }

  // Load news through the local backend adapter and render both news views.
  async function loadNews() {
    if (state.newsLoaded) {
      return;
    }

    showNewsMessage('Loading news...');

    try {
      state.news = await newsService.getNews();
      state.newsLoaded = true;
      showNewsMessage('');
      renderNewsCollection(homeNewsContainer, state.news.slice(0, 3));
      renderNewsCollection(newsListContainer, state.news.slice(0, 6), true);
    } catch (error) {
      showNewsMessage('News is currently unavailable. Please try again later.');
    }
  }

  // Render the full detail view without external navigation.
  function showNewsDetail(newsItem) {
    newsDetailContainer.replaceChildren();

    const image = createNewsImage(newsItem);
    newsDetailContainer.appendChild(image);

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

  // Keep the assistant UI ready for a future backend integration.
  function addConversationMessage(label, text) {
    const item = document.createElement('article');
    item.className = 'conversation-item';

    const heading = document.createElement('strong');
    heading.textContent = label;
    item.appendChild(heading);

    const message = document.createElement('p');
    message.textContent = text;
    item.appendChild(message);
    conversationHistory.appendChild(item);
  }

  viewButtons.forEach((button) => {
    button.addEventListener('click', () => navigateTo(button.dataset.viewTarget));
  });

  window.addEventListener('popstate', () => {
    const viewName = window.history.state && window.history.state.view
      ? window.history.state.view
      : 'home';
    showView(viewName);
  });

  searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const query = searchInput.value.trim();
    const category = categorySelect.value;

    clearResults();
    navigateTo('results');

    if (!query) {
      showMessage('Please enter a search query.');
      return;
    }

    showLoading();

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`);

      if (!response.ok) {
        showMessage('Search failed. Please try again.');
        return;
      }

      const data = await response.json();

      if (data.success === false || data.count === 0) {
        showMessage('No results found.');
        return;
      }

      showMessage('');
      renderResults(Array.isArray(data.results) ? data.results : []);
    } catch (error) {
      showMessage('Unable to connect to the server. Please check your connection.');
    }
  });

  assistantForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const profile = assistantInput.value.trim();

    if (!profile) {
      assistantResponse.textContent = 'Please enter your profile.';
      return;
    }

    assistantResponse.textContent =
      'Analyzing your career opportunities...';

    try {
      const data = await requestCareerAssistant(profile);

      const titles = data.suggested_titles || [];

      if (titles.length === 0) {
        assistantResponse.textContent =
          'No career recommendations found.';
        return;
      }

      const selectedTitle = titles[0];

      const skillsData = await requestCareerKeywords(selectedTitle);

      const skills = skillsData.search_keywords || [];

      assistantResponse.innerHTML = `
        <h2>Recommended Career Paths</h2>
        <ul>
          ${titles.map((title, index) => `
            <li>
              <label>
                <input 
                  type="checkbox" 
                  class="career-path-checkbox"
                  value="${title}"
                >
                ${title}
              </label>
            </li>
          `).join('')}
        </ul>

        <h2>Recommended Skills</h2>
        <ul>
          ${skills.map((skill, index) => `
            <li>
              <label>
                <input 
                  type="checkbox" 
                  class="skill-checkbox"
                  value="${skill}"
                >
                ${skill}
              </label>
            </li>
          `).join('')}
        </ul>

        <button 
          id="search-selected-jobs"
          class="button button-primary"
        >
          Search Jobs
        </button>

        <button 
          id="search-selected-courses"
          class="button button-secondary"
        >
          Search Courses
        </button>

        <div id="search-results-container"></div>
      `;

      const searchSelectedButton =
        document.getElementById("search-selected-jobs");

      const searchCoursesButton =
        document.getElementById("search-selected-courses");

      searchSelectedButton.addEventListener("click", async () => {
        await performSearch('jobs');
      });

      searchCoursesButton.addEventListener("click", async () => {
        await performSearch('courses');
      });

      async function performSearch(type) {
        const selectedTitles = Array.from(
          document.querySelectorAll(".career-path-checkbox:checked")
        ).map(cb => cb.value);

        const selectedSkills = Array.from(
          document.querySelectorAll(".skill-checkbox:checked")
        ).map(cb => cb.value);

        if (selectedTitles.length === 0 && selectedSkills.length === 0) {
          alert("Please select career paths or skills");
          return;
        }

        // --- Build Boolean query for external platforms ---
        function formatTerm(term) {
          return term.includes(' ') ? `"${term}"` : term;
        }

        let booleanParts = [];

        if (selectedTitles.length > 0) {
          const titlesPart = selectedTitles.map(formatTerm).join(' OR ');
          booleanParts.push(`(${titlesPart})`);
        }

        if (selectedSkills.length > 0) {
          const skillsPart = selectedSkills.map(formatTerm).join(' OR ');
          booleanParts.push(`(${skillsPart})`);
        }

        const booleanQuery = booleanParts.join(' AND ');

        // Simple query for Adzuna and courses
        const simpleQuery = [
          ...selectedTitles.slice(0, 2),
          ...selectedSkills.slice(0, 3)
        ].join(' ');

        console.log("BOOLEAN QUERY:", booleanQuery);
        console.log("SIMPLE QUERY:", simpleQuery);

        const container = document.getElementById("search-results-container");

        if (type === 'jobs') {
          // Search for jobs
          container.innerHTML = `
            <h2>Available Jobs</h2>
            <ul id="adzuna-results">
              <li>Searching jobs...</li>
            </ul>
            <div class="external-links">
              <a class="button button-primary" href="https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(booleanQuery)}" target="_blank">LinkedIn</a>
              <a class="button button-primary" href="https://www.indeed.com/jobs?q=${encodeURIComponent(booleanQuery)}" target="_blank">Indeed</a>
              <a class="button button-primary" href="https://www.jobs.ch/en/vacancies/?term=${encodeURIComponent(booleanQuery)}" target="_blank">Jobs.ch</a>
            </div>
          `;

          try {
            const jobsData = await requestJobs(simpleQuery);
            const jobs = jobsData.adzuna_jobs || [];
            const jobsList = document.getElementById("adzuna-results");
            jobsList.innerHTML = jobs.length
              ? jobs.map(job => `
                  <li>
                    <strong>${job.title || "Job"}</strong>
                    <br>
                    ${job.company || ""}
                    <br>
                    ${job.location || ""}
                    ${job.url ? `<br><a href="${job.url}" target="_blank">Open</a>` : ""}
                  </li>
                `).join("")
              : "<li>No jobs found</li>";
          } catch (error) {
            console.error("ADZUNA ERROR:", error);
            const jobsList = document.getElementById("adzuna-results");
            jobsList.innerHTML = `<li>❌ Error loading jobs: ${error.message || 'unknown error'}</li>`;
          }
        } else {
          // Search for courses
          container.innerHTML = `
            <h2>Available Courses</h2>
            <ul id="courses-results">
              <li>Searching courses...</li>
            </ul>
            <div class="external-links">
              <a class="button button-primary" href="https://www.coursera.org/search?query=${encodeURIComponent(simpleQuery)}" target="_blank">Coursera</a>
              <a class="button button-primary" href="https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(simpleQuery)}" target="_blank">LinkedIn Learning</a>
              <a class="button button-primary" href="https://www.google.com/search?q=${encodeURIComponent(simpleQuery)}+online+course" target="_blank">Google</a>
            </div>
          `;

          try {
            const coursesData = await requestCourses(simpleQuery);
            const courses = coursesData.courses || [];
            const coursesList = document.getElementById("courses-results");
            coursesList.innerHTML = courses.length
              ? courses.map(course => `
                  <li>
                    <strong>${course.title || "Course"}</strong>
                    <br>
                    ${course.provider || ""}
                    <br>
                    ${course.location || ""}
                    ${course.url ? `<br><a href="${course.url}" target="_blank">Open</a>` : ""}
                  </li>
                `).join("")
              : "<li>No courses found</li>";
          } catch (error) {
            console.error("COURSES ERROR:", error);
            const coursesList = document.getElementById("courses-results");
            coursesList.innerHTML = `<li>❌ Error loading courses: ${error.message || 'unknown error'}</li>`;
          }
        }
      }

    } catch (error) {
      console.error(error);
      assistantResponse.textContent =
        'Career Assistant is currently unavailable.';
    }
  });

  document.querySelectorAll('[data-placeholder-link="true"]').forEach((link) => {
    link.addEventListener('click', (event) => event.preventDefault());
  });

  copyrightYear.textContent = new Date().getFullYear();

  const validViews = new Set(viewElements.map((view) => view.dataset.view));
  const requestedView = window.location.hash.slice(1);
  const initialView = validViews.has(requestedView) ? requestedView : 'home';
  navigateTo(initialView, true);
});