// routes/search.js
// Search API routes for UA TECH FLOW AI Assistant

const express = require("express");

const router = express.Router();

// Temporary search endpoint
// Real aggregation logic will be added in utils/aggregator.js

router.get("/search", async (req, res) => {
  const query = req.query.q || "";

  res.json({
    success: true,
    query: query,
    results: [
      {
        title: "Example education resource",
        description: "Temporary test result",
        category: "education",
        source: "UA TECH FLOW"
      }
    ]
  });
});

module.exports = router;