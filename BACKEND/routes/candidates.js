const express = require("express");
const { Candidate, Vote, StudentVerification } = require("../models");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Get all candidates (public)
router.get("/candidates", async (req, res) => {
  const candidates = await Candidate.find();
  res.send(candidates);
});

// Add candidate (admin only)
router.post("/admin/candidates", verifyToken, async (req, res) => {
  const { name, post, description } = req.body;
  await Candidate.create({ name, post, description });
  res.send({ message: "Candidate added" });
});

// Delete candidate (admin only)
router.delete("/admin/candidates/:id", verifyToken, async (req, res) => {
  await Candidate.findByIdAndDelete(req.params.id);
  res.send({ message: "Candidate removed" });
});

// Vote for candidate
router.post("/vote", async (req, res) => {
  const { matric, candidateId, verified } = req.body;

  // If verified parameter is provided, check if it's valid
  if (verified) {
    const verification = await StudentVerification.findOne({
      matric: verified,
      isUsed: true,
    });

    if (!verification || verification.matric !== matric) {
      return res.status(400).send({ message: "Invalid verification" });
    }
  }

  const alreadyVoted = await Vote.findOne({ matric });
  if (alreadyVoted) {
    return res.status(400).send({ message: "You have already voted" });
  }

  const candidate = await Candidate.findById(candidateId);
  if (!candidate) {
    return res.status(400).send({ message: "Candidate not found" });
  }

  await Vote.create({ matric, candidateId });
  candidate.votes += 1;
  await candidate.save();

  res.send({ message: "Vote recorded successfully" });
});

module.exports = router;
