// test-backend.js
// This script tests the backend API responses for career suggestions and keywords.

const CAREER_API_URL = "https://job.uatechflow.org/process";

async function testBackend() {
  console.log("=== Testing Backend API ===\n");

  // 1. Test suggest_job_titles with a profile
  const profile = "cook"; // Change this to test different profiles
  console.log(`1. Requesting suggest_job_titles for profile: "${profile}"`);
  try {
    const titlesResponse = await fetch(CAREER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "suggest_job_titles",
        resumeText: profile,
        language: "en"
      })
    });
    const titlesData = await titlesResponse.json();
    console.log("Response:", JSON.stringify(titlesData, null, 2));
    console.log("Suggested titles:", titlesData.suggested_titles || []);

    // 2. For each suggested title, request keywords
    const titles = titlesData.suggested_titles || [];
    if (titles.length > 0) {
      console.log("\n2. Requesting keywords for each title:");
      for (const title of titles) {
        console.log(`\n--- Title: "${title}" ---`);
        const keywordsResponse = await fetch(CAREER_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "extract_keywords_for_search",
            title: title,
            language: "en"
          })
        });
        const keywordsData = await keywordsResponse.json();
        console.log("Response:", JSON.stringify(keywordsData, null, 2));
        console.log("Keywords:", keywordsData.search_keywords || []);
      }
    } else {
      console.log("No titles returned.");
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testBackend();