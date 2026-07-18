// routes/search.js — API endpoint for unified search

const express = require("express");
const router = express.Router();

const { aggregateResources } = require("../utils/aggregator");

// GET /api/search?q=...&category=...
router.get("/", async (req, res) => {
  const q = req.query.q || "";
  const category = req.query.category || "all";

  try {
    const results = await aggregateResources(q, category);

    res.json({
      success: true,
      count: results.length,
      results
    });

  } catch (error) {
    console.error("Search error:", error.message);

    res.status(500).json({
      success: false,
      message: "Search failed. Please try again later.",
      results: []
    });
  }
});

module.exports = router;