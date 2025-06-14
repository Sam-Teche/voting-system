const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { Link } = require("../models");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Generate voting link (admin only)
router.post("/generate-link", verifyToken, async (req, res) => {
  const url = `https://extraordinary-sprite-215820.netlify.app/vote/${uuidv4()}`;
  await Link.create({ url });
  res.send({ message: "Link generated successfully" });
});

// Get all generated links (admin only)
router.get("/links", verifyToken, async (req, res) => {
  const links = await Link.find();
  res.send(links);
});

module.exports = router;
