const express = require("express");
const { Candidate } = require("../models");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Get voting results (admin only) - Calculate each post separately
router.get("/results", verifyToken, async (req, res) => {
  const candidates = await Candidate.find();

  // Group candidates by post
  const candidatesByPost = candidates.reduce((acc, candidate) => {
    if (!acc[candidate.post]) {
      acc[candidate.post] = [];
    }
    acc[candidate.post].push(candidate);
    return acc;
  }, {});

  // Calculate results for each post separately
  const resultsByPost = {};
  let grandTotalVotes = 0;

  Object.keys(candidatesByPost).forEach((post) => {
    const postCandidates = candidatesByPost[post];
    const postTotalVotes = postCandidates.reduce((sum, c) => sum + c.votes, 0);
    grandTotalVotes += postTotalVotes;

    resultsByPost[post] = {
      candidates: postCandidates.map((c) => ({
        name: c.name,
        post: c.post,
        votes: c.votes,
        percentage:
          postTotalVotes > 0
            ? ((c.votes / postTotalVotes) * 100).toFixed(2)
            : "0.00",
      })),
      totalVotesForPost: postTotalVotes,
    };
  });

  res.send({
    resultsByPost,
    grandTotalVotes,
    // Also include flat array for backward compatibility
    allCandidates: candidates.map((c) => {
      const postTotalVotes = candidatesByPost[c.post].reduce(
        (sum, candidate) => sum + candidate.votes,
        0
      );
      return {
        name: c.name,
        post: c.post,
        votes: c.votes,
        percentage:
          postTotalVotes > 0
            ? ((c.votes / postTotalVotes) * 100).toFixed(2)
            : "0.00",
      };
    }),
  });
});

module.exports = router;
