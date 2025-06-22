const express = require("express");
const { VotingCode } = require("../models");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// ✅ Generate a unique 5-digit voting code
router.post("/voting-codes", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;

    // Generate random 5-digit code
    const code = Math.floor(10000 + Math.random() * 90000).toString();

    // Ensure uniqueness for this admin
    const existing = await VotingCode.findOne({ code, adminId });
    if (existing) {
      return res.status(400).send({ message: "Duplicate code. Try again." });
    }

    const newCode = await VotingCode.create({ code, adminId });

    res.send({
      message: "Voting code generated successfully",
      code: newCode.code,
      createdAt: newCode.createdAt,
    });
  } catch (err) {
    res
      .status(500)
      .send({ message: "Error generating code", error: err.message });
  }
});

// ✅ List all voting codes for this admin
router.get("/voting-codes", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const codes = await VotingCode.find({ adminId }).sort({ createdAt: -1 });

    res.send({ total: codes.length, codes });
  } catch (err) {
    res
      .status(500)
      .send({ message: "Error fetching codes", error: err.message });
  }
});

// ✅ (Optional) Delete a voting code
router.delete("/voting-codes/:code", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const codeToDelete = req.params.code;

    const deleted = await VotingCode.findOneAndDelete({
      code: codeToDelete,
      adminId,
    });

    if (!deleted) {
      return res
        .status(404)
        .send({ message: "Code not found or not owned by admin" });
    }

    res.send({ message: "Voting code deleted", code: deleted.code });
  } catch (err) {
    res
      .status(500)
      .send({ message: "Error deleting code", error: err.message });
  }
});

module.exports = router;
