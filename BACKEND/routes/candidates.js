const express = require("express");
const { Candidate, Vote, StudentVerification, Admin } = require("../models");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Helper function to ensure VOID candidate exists for a position
const ensureVoidCandidate = async (position, adminId = null) => {
  try {
    const voidExists = await Candidate.findOne({
      name: "VOID",
      post: position,
    });

    if (!voidExists) {
      await Candidate.create({
        name: "VOID",
        post: position,
        description:
          "Vote for VOID if you don't want to vote for any candidate in this position",
        adminId: adminId,
        votes: 0,
      });
      console.log(`✅ VOID candidate created for position: ${position}`);
    }
  } catch (error) {
    console.error(
      `❌ Error creating VOID candidate for ${position}:`,
      error.message
    );
  }
};

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
    res.status(500).send({
      message: "Error fetching candidates for position",
      error: error.message,
    });
  }
});

// Add candidate (admin only) - automatically creates VOID candidate
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

    // Automatically ensure VOID candidate exists for this position
    await ensureVoidCandidate(post, req.user.id);

    // Get updated count for this position
    const candidatesForPosition = await Candidate.countDocuments({ post });

    res.send({
      message: `Candidate added successfully. ${post} now has ${candidatesForPosition} candidate(s) (including VOID)`,
      candidate: newCandidate,
      totalCandidatesForPosition: candidatesForPosition,
    });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error adding candidate", error: error.message });
  }
});

// Create VOID candidates for all existing positions (admin utility)
router.post("/admin/create-void-candidates", verifyToken, async (req, res) => {
  try {
    // Get all unique positions
    const positions = await Candidate.distinct("post");

    let createdCount = 0;
    for (const position of positions) {
      const voidExists = await Candidate.findOne({
        name: "VOID",
        post: position,
      });

      if (!voidExists) {
        await Candidate.create({
          name: "VOID",
          post: position,
          description:
            "Vote for VOID if you don't want to vote for any candidate in this position",
          adminId: req.user.id,
          votes: 0,
        });
        createdCount++;
      }
    }

    res.send({
      message: `VOID candidates creation completed. Created ${createdCount} new VOID candidates.`,
      totalPositions: positions.length,
      createdVoidCandidates: createdCount,
      positions: positions,
    });
  } catch (error) {
    res
      .status(500)
      .send({
        message: "Error creating VOID candidates",
        error: error.message,
      });
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
          hasVoid: {
            $sum: {
              $cond: [{ $eq: ["$name", "VOID"] }, 1, 0],
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
    res.status(500).send({
      message: "Error fetching positions summary",
      error: error.message,
    });
  }
});

// Delete candidate (admin only) - prevents deletion of VOID candidates
router.delete("/admin/candidates/:id", verifyToken, async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).send({ message: "Candidate not found" });
    }
    /*
    // Prevent deletion of VOID candidates
    if (candidate.name === "VOID") {
      return res.status(400).send({
        message: "Cannot delete VOID candidate. VOID candidates are required for each position.",
      });
    }
    */
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

    // Update Whitelist - assuming this should be imported or the line should be removed
    // await Whitelist.updateOne({ matric }, { $set: { voted: true } });

    // Update candidate vote count
    candidate.votes += 1;
    await candidate.save();

    const voteMessage =
      candidate.name === "VOID"
        ? `VOID vote recorded for ${candidate.post}`
        : `Vote recorded successfully for ${candidate.name} (${candidate.post})`;

    res.send({
      message: voteMessage,
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
      isVoid: candidate.name === "VOID",
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
