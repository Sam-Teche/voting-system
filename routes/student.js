const express = require("express");
const crypto = require("crypto");
const {
  StudentVerification,
  Whitelist,
  Vote,
  Candidate,
} = require("../models");
const { sendEmail } = require("../utils/email");

const router = express.Router();

// Send verification email to student
router.post("/send-verification", async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const matric = req.body.matric?.trim().toUpperCase();
/*
  if (!matric.startsWith("SVG")) {
    return res
      .status(400)
      .send({ message: "Matric number must start with SVG" });
  }
*/
  // Check if student is whitelisted
  const found = await Whitelist.findOne({
    email: email.toLowerCase().trim(),
    matric: matric.toUpperCase().trim(),
  });

  if (!found) {
    return res.status(400).send({
      message:
        "You are not an eligible voter, Kindly reach out to the electoral.",
    });
  }

  // Check if already voted
  const alreadyVoted = await Vote.findOne({ matric });
  if (alreadyVoted) {
    return res.status(400).send({ message: "You have already voted" });
  }

  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  // Save or update verification record
  await StudentVerification.findOneAndUpdate(
    { matric },
    {
      email,
      matric,
      verificationToken,
      verificationExpires,
      isUsed: false,
    },
    { upsert: true }
  );

  // Send verification email
  const verificationUrl = `${req.protocol}://${req.get(
    "host"
  )}/api/student/verify-email/${verificationToken}`;

  const emailHtml = `
    <h2>Verify Your Email for Voting</h2>
    <p>Hello ${matric},</p>
    <p>Please click the link below to verify your email and proceed to vote:</p>
    <a href="${verificationUrl}" style="background-color: #2196F3; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;">Verify & Vote</a>
    <p>This link will expire in 30 minutes.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;

  const emailSent = await sendEmail(
    email,
    "Verify Your Email for Voting",
    emailHtml
  );

  if (!emailSent) {
    return res
      .status(500)
      .send({ message: "Failed to send verification email" });
  }

  res.send({ message: "Verification email sent. Please check your email." });
});

// Student Email Verification
router.get("/verify-email/:token", async (req, res) => {
  const { token } = req.params;

  const verification = await StudentVerification.findOne({
    verificationToken: token,
    verificationExpires: { $gt: Date.now() },
    isUsed: false,
  });

  if (!verification) {
    return res.status(400).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2 style="color: #f44336;">Invalid or Expired Link</h2>
          <p>This verification link is invalid or has expired.</p>
          <a href="https://extraordinary-sprite-215820.netlify.app" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Go Back</a>
        </body>
      </html>
    `);
  }

  // Mark as used
  verification.isUsed = true;
  await verification.save();

  // Redirect to voting page with verified matric
  const votingUrl = `https://extraordinary-sprite-215820.netlify.app/vote?verified=${verification.matric}`;

  res.redirect(votingUrl);
});

// Updated Student Login (for direct login without email verification)

module.exports = router;
