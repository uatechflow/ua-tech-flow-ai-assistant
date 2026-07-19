document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const categorySelect = document.getElementById('category-select');
  const resultsContainer = document.getElementById('results');
  const messageElement = document.getElementById('message');

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

  // Render each result using semantic DOM elements without inserting HTML strings.
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

  searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const query = searchInput.value.trim();
    const category = categorySelect.value;

    clearResults();

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
});
