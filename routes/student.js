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
  try {
    // Input validation
    if (!req.body.email || !req.body.matric) {
      return res.status(400).send({
        message: "Email and matric number are required",
      });
    }

    const email = req.body.email?.trim().toLowerCase();
    const matric = req.body.matric?.trim().toUpperCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).send({
        message: "Please provide a valid email address",
      });
    }

    // Validate matric format (uncomment if needed)
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
          "You are not an eligible voter. Kindly reach out to the electoral committee.",
      });
    }

    // Check if already voted
    const alreadyVoted = await Vote.findOne({ matric });
    if (alreadyVoted) {
      return res.status(400).send({
        message: "You have already voted",
      });
    }

    // Check if there's an existing unused verification within the last 5 minutes
    const recentVerification = await StudentVerification.findOne({
      matric,
      verificationExpires: { $gt: Date.now() },
      isUsed: false,
      createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) }, // 5 minutes ago
    });

    if (recentVerification) {
      return res.status(429).send({
        message:
          "Please wait 5 minutes before requesting another verification email",
      });
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
        createdAt: new Date(), // Add timestamp
      },
      { upsert: true, new: true }
    );

    // Construct verification URL
    const host = req.get("host");
    const protocol =
      req.secure || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    const verificationUrl = `${protocol}://${host}/api/student/verify-email/${verificationToken}`;

    // Email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2196F3;">Verify Your Email for Voting</h2>
        <p>Hello ${matric},</p>
        <p>Please click the link below to verify your email and proceed to vote:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #2196F3; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify & Vote</a>
        </div>
        <p><strong>This link will expire in 30 minutes.</strong></p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr>
        <small style="color: #666;">If the button doesn't work, copy and paste this link: ${verificationUrl}</small>
      </div>
    `;

    // Send verification email
    const emailSent = await sendEmail(
      email,
      "Verify Your Email for Voting",
      emailHtml
    );

    if (!emailSent) {
      // Log the error for debugging
      console.error("Failed to send verification email to:", email);
      return res.status(500).send({
        message: "Failed to send verification email. Please try again later.",
      });
    }

    console.log(`Verification email sent to ${email} for matric ${matric}`);
    res.send({
      message:
        "Verification email sent. Please check your email and spam folder.",
    });
  } catch (error) {
    console.error("Send verification error:", error);
    res.status(500).send({
      message:
        "An error occurred while sending verification email. Please try again.",
    });
  }
});

// Student Email Verification
router.get("/verify-email/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Validate token format
    if (!token || token.length !== 64) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #f44336;">Invalid Link</h2>
            <p>This verification link is invalid.</p>
            <a href="https://busyvotingsystem.netlify.app" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Go Back</a>
          </body>
        </html>
      `);
    }

    const verification = await StudentVerification.findOne({
      verificationToken: token,
      verificationExpires: { $gt: Date.now() },
      isUsed: false,
    });

    if (!verification) {
      console.log(`Invalid or expired verification token: ${token}`);
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #f44336;">Invalid or Expired Link</h2>
            <p>This verification link is invalid or has expired.</p>
            <p>Please request a new verification email.</p>
            <a href="https://busyvotingsystem.netlify.app" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Go Back</a>
          </body>
        </html>
      `);
    }

    // Check if student has already voted (double-check)
    const alreadyVoted = await Vote.findOne({ matric: verification.matric });
    if (alreadyVoted) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #f44336;">Already Voted</h2>
            <p>You have already cast your vote.</p>
            <a href="https://busyvotingsystem.netlify.app" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Go Back</a>
          </body>
        </html>
      `);
    }

    // Mark as used
    verification.isUsed = true;
    verification.verifiedAt = new Date();
    await verification.save();

    console.log(`Email verified for matric: ${verification.matric}`);

    // Redirect to voting page with verified matric
    const votingUrl = `https://busyvotingsystem.netlify.app/vote?verified=${verification.matric}`;
    res.redirect(votingUrl);
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2 style="color: #f44336;">Server Error</h2>
          <p>An error occurred during verification. Please try again.</p>
          <a href="https://busyvotingsystem.netlify.app" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Go Back</a>
        </body>
        </html>
    `);
  }
});

module.exports = router;
