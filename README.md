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
