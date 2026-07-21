# UA TECH FLOW AI Assistant

**Live Demo:** [https://aica.uatechflow.org/](https://aica.uatechflow.org/)

Unified Search for Education, Jobs, and Career Guidance — built for newcomers in Europe. This project was created for the **OpenAI Build Week** (GPT-5.6 & Codex) and aggregates data from two separate portals into a single intelligent interface.

## Features

- **Unified Search:** Search for `jobs`, `education`, or `all` across both the UA TECH FLOW Job and Education portals simultaneously.
- **AI Career Assistant:** Describe your background (e.g., "Mechanical engineer from Ukraine living in Switzerland"). The assistant suggests tailored career paths and extracts relevant skills to search for jobs and courses.
- **External Platform Integration:** Convert AI-suggested skills into Boolean queries and search directly on LinkedIn, Indeed, Jobs.ch, Coursera, and edX.
- **News Hub:** Automatically fetches and caches the latest news from the UA TECH FLOW portal.

## Tech Stack

- **Backend:** Node.js (v22), Express, native `fetch` API.
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (no frameworks, fully accessible with semantic elements).
- **Caching:** File-based JSON cache for news synchronization.

## Getting Started (Local Development)

Follow these steps to run the project on your own machine.

### Prerequisites
- Node.js 22 or higher installed.
- npm (comes with Node.js).

### Installation

1.  Clone the repository:
    ```bash
    git clone <your-repository-url>
    cd ua-tech-flow-ai-assistant

2. Install dependencies:

bash
npm install
Running the Server
Start the development server with auto-reload:

bash
npm run dev
Or start it normally:

bash
npm start
Open http://localhost:3000 in your browser to view the application.

Architecture Overview
Backend Entry (server.js): Sets up Express, serves static files from the public/ directory, and mounts the API routes.

Search Router (routes/search.js): Handles requests to /api/search and calls the aggregator.

News Router (routes/news.js): Handles requests to /api/news and reads from the local cache.

Aggregator (utils/aggregator.js): Manages parallel fetching from job.uatechflow.org (POST /process) and edu.uatechflow.org (GET /api/opportunities). Merges results with job priority.

News Sync (utils/newsSync.js): Periodically fetches news from uatechflow.org/api/news and caches the latest 6 items to data/news-cache.json.

Frontend (public/): Contains all static assets. public/script.js manages SPA-like navigation, search logic, and the AI Career Assistant workflow.

Codex Collaboration & Key Decisions
This project was built in active collaboration with Codex (GPT-5.6). The full collaboration log is available in CODEX_LOG.md.

How Codex Accelerated Development:
Complex Aggregation Logic: Codex generated the core utils/aggregator.js, which handles conditional fetching based on the category parameter and resilient error handling (if one API fails, the other continues).

Frontend Rendering: Codex built the main public/script.js using semantic HTML elements (<article>, <dl>) and document.createElement() instead of innerHTML, ensuring accessibility and performance.

News Synchronization: Codex wrote the utils/newsSync.js module to manage file-based caching without external dependencies, preserving cache on API failure.

Key Product & Design Decisions:
Job Priority: Search results display job vacancies before educational opportunities, prioritizing immediate employment for newcomers.

Boolean Query Generation: To bridge the gap between AI suggestions and external platforms, we convert selected skills/titles into Boolean queries (e.g., ("Software Engineer" OR "QA") AND (Python OR SQL)) for LinkedIn and Indeed.

No Database: We chose JSON file caching for news to keep the project lightweight, production-ready, and deployable without a dedicated database setup.

Submission Information (OpenAI Build Week)
Hackathon: OpenAI Build Week

Track: Education

Live Demo: https://aica.uatechflow.org/

Codex Session ID: codex://threads/019f771e-bb40-7a71-ae31-534520e81719

Built with ❤️ for the OpenAI Build Week.
