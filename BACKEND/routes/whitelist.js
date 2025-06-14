const express = require("express");
const { Whitelist } = require("../models");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Get whitelist (admin only)
router.get("/whitelist", verifyToken, async (req, res) => {
  const whitelist = await Whitelist.find().select("matric");
  res.send(whitelist.map((w) => w.matric));
});

// Add single matric to whitelist (admin only)
router.post("/whitelist", verifyToken, async (req, res) => {
  const { matric } = req.body;
  await Whitelist.create({ matric });
  res.send({ message: "Matric added to whitelist" });
});

// Bulk add matrics to whitelist (admin only)
router.post("/whitelist/bulk", verifyToken, async (req, res) => {
  const { matricNumbers } = req.body;
  const bulkInsert = matricNumbers.map((matric) => ({ matric }));
  await Whitelist.insertMany(bulkInsert, { ordered: false }).catch(() => {});
  res.send({ message: "Bulk insert completed" });
});

// Remove matric from whitelist (admin only)
router.delete("/whitelist/:matric", verifyToken, async (req, res) => {
  await Whitelist.deleteOne({ matric: req.params.matric });
  res.send({ message: "Matric removed" });
});

module.exports = router;
