const express = require("express");
const { Candidate, Vote, StudentVerification, Admin } = require("../models");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Get all candidates grouped by position (public)
router.get("/candidates", async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ post: 1, name: 1 });

    // Group candidates by position for easier frontend handling
    const candidatesByPosition = candidates.reduce((acc, candidate) => {
      if (!acc[candidate.post]) {
        acc[candidate.post] = [];
      }
      acc[candidate.post].push(candidate);
      return acc;
    }, {});

    res.send({
      success: true,
      candidates,
      candidatesByPosition,
      positions: Object.keys(candidatesByPosition),
    });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error fetching candidates", error: error.message });
  }
});

// Get candidates for a specific position
router.get("/candidates/position/:position", async (req, res) => {
  try {
    const { position } = req.params;
    const candidates = await Candidate.find({ post: position }).sort({
      name: 1,
    });

    res.send({
      success: true,
      position,
      candidates,
      count: candidates.length,
    });
  } catch (error) {
    res
      .status(500)
      .send({
        message: "Error fetching candidates for position",
        error: error.message,
      });
  }
});

// Add candidate (admin only) - explicitly supports multiple candidates per position
router.post("/admin/candidates", verifyToken, async (req, res) => {
  try {
    const { name, post, description } = req.body;

    // Check if candidate already exists for this position
    const existingCandidate = await Candidate.findOne({ name, post });
    if (existingCandidate) {
      return res.status(400).send({
        message: `${name} is already a candidate for ${post}`,
      });
    }

    const newCandidate = await Candidate.create({
      name,
      post,
      description,
      adminId: req.user.id,
      votes: 0,
    });

    // Get updated count for this position
    const candidatesForPosition = await Candidate.countDocuments({ post });

    res.send({
      message: `Candidate added successfully. ${post} now has ${candidatesForPosition} candidate(s)`,
      candidate: newCandidate,
      totalCandidatesForPosition: candidatesForPosition,
    });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error adding candidate", error: error.message });
  }
});

// Get summary of all positions and their candidate counts
router.get("/admin/positions-summary", verifyToken, async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: "$post",
          candidateCount: { $sum: 1 },
          totalVotes: { $sum: "$votes" },
          candidates: {
            $push: {
              name: "$name",
              votes: "$votes",
              id: "$_id",
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ];

    const positionsSummary = await Candidate.aggregate(pipeline);

    res.send({
      success: true,
      positions: positionsSummary,
      totalPositions: positionsSummary.length,
    });
  } catch (error) {
    res
      .status(500)
      .send({
        message: "Error fetching positions summary",
        error: error.message,
      });
  }
});

// Delete candidate (admin only)
router.delete("/admin/candidates/:id", verifyToken, async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).send({ message: "Candidate not found" });
    }

    const position = candidate.post;
    await Candidate.findByIdAndDelete(req.params.id);

    // Get remaining count for this position
    const remainingCandidates = await Candidate.countDocuments({
      post: position,
    });

    res.send({
      message: "Candidate removed successfully",
      position,
      remainingCandidatesForPosition: remainingCandidates,
    });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error removing candidate", error: error.message });
  }
});

// Vote for candidate - supports choosing from multiple candidates per position
router.post("/vote", async (req, res) => {
  try {
    const { matric, candidateId, verified } = req.body;

    // Verification check
    if (verified) {
      const verification = await StudentVerification.findOne({
        matric: verified,
        isUsed: true,
      });

      if (!verification || verification.matric !== matric) {
        return res.status(400).send({ message: "Invalid verification" });
      }
    }

    // Find the candidate
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(400).send({ message: "Candidate not found" });
    }

    // Check if student has already voted for this position
    const existingVoteForPosition = await Vote.findOne({
      matric,
      position: candidate.post,
    });

    if (existingVoteForPosition) {
      const votedCandidate = await Candidate.findById(
        existingVoteForPosition.candidateId
      );
      return res.status(400).send({
        message: `You have already voted for ${candidate.post}. You voted for ${votedCandidate.name}`,
      });
    }

    // Get all candidates for this position to show voter their options
    const allCandidatesForPosition = await Candidate.find({
      post: candidate.post,
    });

    // Record the vote
    await Vote.create({
      matric,
      candidateId,
      position: candidate.post,
      adminId: candidate.adminId,
    });

    // Update candidate vote count
    candidate.votes += 1;
    await candidate.save();

    res.send({
      message: `Vote recorded successfully for ${candidate.name} (${candidate.post})`,
      votedFor: {
        name: candidate.name,
        position: candidate.post,
      },
      availableCandidates: allCandidatesForPosition.length,
    });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error recording vote", error: error.message });
  }
});

// Get voting progress for a position
router.get("/results/:position", async (req, res) => {
  try {
    const { position } = req.params;

    const candidates = await Candidate.find({ post: position }).sort({
      votes: -1,
    });
    const totalVotes = candidates.reduce(
      (sum, candidate) => sum + candidate.votes,
      0
    );

    const results = candidates.map((candidate) => ({
      name: candidate.name,
      votes: candidate.votes,
      percentage:
        totalVotes > 0 ? ((candidate.votes / totalVotes) * 100).toFixed(2) : 0,
    }));

    res.send({
      success: true,
      position,
      totalCandidates: candidates.length,
      totalVotes,
      results,
    });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error fetching results", error: error.message });
  }
});

module.exports = router;
