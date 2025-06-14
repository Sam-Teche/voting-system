const express = require("express");
const { Candidate } = require("../models");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Get voting results (admin only)
router.get("/results", verifyToken, async (req, res) => {
  const candidates = await Candidate.find();
  const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
  res.send({
    candidates: candidates.map((c) => ({
      name: c.name,
      post: c.post,
      votes: c.votes,
      percentage:
        totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(2) : "0.00",
    })),
    totalVotes,
  });
});

module.exports = router;
