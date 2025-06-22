const express = require("express");
const { Whitelist, VotingCode } = require("../models");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// 🧑‍🎓 Student verifies eligibility
router.post("/verify-student", async (req, res) => {
  const { email, matric, code } = req.body;

  const votingCode = await VotingCode.findOne({ code });
  if (!votingCode) {
    return res.status(400).send({ message: "Invalid voting code" });
  }

  const whitelistEntry = await Whitelist.findOne({
    email: email.toLowerCase().trim(),
    matric: matric.toUpperCase().trim(),
    adminId: votingCode.adminId,
  });

  if (!whitelistEntry) {
    return res.status(403).send({ message: "Not whitelisted for this admin" });
  }

  if (whitelistEntry.voted) {
    return res.status(400).send({ message: "You have already voted" });
  }

  res.send({ message: "Verified, you can vote", adminId: votingCode.adminId });
});

// 🧑‍💼 Admin generates a 5-digit code
router.post("/generate-code", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const code = Math.floor(10000 + Math.random() * 90000).toString();

    const existing = await VotingCode.findOne({ code, adminId });
    if (existing)
      return res
        .status(400)
        .send({ message: "Code already exists. Try again." });

    const newCode = await VotingCode.create({ code, adminId });

    res.send({
      message: "Voting code generated successfully",
      code: newCode.code,
      createdAt: newCode.createdAt,
    });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error generating code", error: error.message });
  }
});

module.exports = router;
