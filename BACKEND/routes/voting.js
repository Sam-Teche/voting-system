const express = require("express");
const { Whitelist, VotingCode } = require("../models");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// ✅ Verify login with code + whitelist check
router.post("/verify-student", async (req, res) => {
  const { email, matric, code } = req.body;

  // Step 1: Check if code is valid
  const votingCode = await VotingCode.findOne({ code });
  if (!votingCode) {
    return res.status(400).send({ message: "Invalid voting code" });
  }

  // Step 2: Check if student exists in whitelist under that admin
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

  // ✅ Passed all checks
  res.send({
    message: "Verified, you can vote",
    adminId: votingCode.adminId, // you'll use this when casting the vote
  });
});

module.exports = router;
