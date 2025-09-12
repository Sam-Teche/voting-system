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

// Configuration - Replace with your actual backend URL
const BACKEND_URL = "https://voting-backend-yf6o.onrender.com";

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

    console.log(`Processing verification request for: ${email}, ${matric}`);

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
      email: email,
      matric: matric,
    });

    if (!found) {
      console.log(`Student not whitelisted: ${email}, ${matric}`);
      return res.status(400).send({
        message:
          "You are not an eligible voter. Kindly reach out to the electoral committee.",
      });
    }

    console.log(`Student found in whitelist: ${found._id}`);

    // Check if already voted
    const alreadyVoted = await Vote.findOne({ matric });
    if (alreadyVoted) {
      console.log(`Student already voted: ${matric}`);
      return res.status(400).send({
        message: "You have already voted",
      });
    }

    // Check if there's an existing unused verification within the last 5 minutes to prevent spam
    const recentVerification = await StudentVerification.findOne({
      matric,
      verificationExpires: { $gt: Date.now() },
      isUsed: false,
      createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) }, // 5 minutes ago
    });

    if (recentVerification) {
      console.log(`Rate limiting verification request for: ${matric}`);
      return res.status(429).send({
        message:
          "Please wait 5 minutes before requesting another verification email",
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    console.log(
      `Generated token for ${matric}: ${verificationToken.substring(0, 8)}...`
    );

    // Save or update verification record
    const verification = await StudentVerification.findOneAndUpdate(
      { matric },
      {
        email,
        matric,
        verificationToken,
        verificationExpires,
        isUsed: false,
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log(`Verification record saved: ${verification._id}`);

    // FIXED: Use hardcoded backend URL instead of req.get('host')
    const verificationUrl = `${BACKEND_URL}/api/student/verify-email/${verificationToken}`;

    console.log(`Verification URL: ${verificationUrl}`);

    // Enhanced email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Email Verification</h1>
          <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">Verify your email to cast your vote</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hello <strong>${matric}</strong>,</p>
          
          <p style="font-size: 16px; color: #555; line-height: 1.6;">
            You have requested to verify your email address to participate in the voting process. 
            Click the button below to verify your email and proceed to cast your vote.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      font-size: 16px; 
                      font-weight: bold; 
                      display: inline-block; 
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                      transition: transform 0.2s;">
              ✓ Verify Email & Vote
            </a>
          </div>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>⏰ Important:</strong> This verification link will expire in 30 minutes.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #777; margin-top: 25px;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; color: #555;">
            ${verificationUrl}
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
          
          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            If you didn't request this verification, please ignore this email.<br>
            This is an automated message, please do not reply.
          </p>
        </div>
      </div>
    `;

    // Send verification email
    console.log(`Sending verification email to: ${email}`);
    const emailSent = await sendEmail(
      email,
      "🗳️ Verify Your Email for Voting - Action Required",
      emailHtml
    );

    if (!emailSent) {
      console.error(`Failed to send verification email to: ${email}`);
      return res.status(500).send({
        message: "Failed to send verification email. Please try again later.",
      });
    }

    console.log(`Verification email sent successfully to: ${email}`);
    res.send({
      message:
        "Verification email sent successfully! Please check your email and spam folder.",
    });
  } catch (error) {
    console.error("Send verification error:", error);
    res.status(500).send({
      message:
        "An error occurred while processing your request. Please try again.",
    });
  }
});

// Student Email Verification
router.get("/verify-email/:token", async (req, res) => {
  try {
    const { token } = req.params;

    console.log(
      `Processing verification for token: ${token.substring(0, 8)}...`
    );

    // Validate token format (should be 64 hex characters)
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      console.log(`Invalid token format: ${token}`);
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Invalid Verification Link</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .error { color: #e74c3c; }
                .btn { background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2 class="error">❌ Invalid Verification Link</h2>
                <p>This verification link is not valid. Please request a new verification email.</p>
                <a href="https://busyvotingsystem.netlify.app" class="btn">← Go Back to Voting System</a>
            </div>
        </body>
        </html>
      `);
    }

    // Find verification record
    const verification = await StudentVerification.findOne({
      verificationToken: token,
      verificationExpires: { $gt: Date.now() },
      isUsed: false,
    });

    if (!verification) {
      console.log(
        `Verification not found or expired for token: ${token.substring(
          0,
          8
        )}...`
      );

      // Check if token exists but is expired/used
      const expiredVerification = await StudentVerification.findOne({
        verificationToken: token,
      });

      let errorMessage = "This verification link is invalid or has expired.";
      if (expiredVerification) {
        if (expiredVerification.isUsed) {
          errorMessage = "This verification link has already been used.";
        } else if (expiredVerification.verificationExpires <= Date.now()) {
          errorMessage =
            "This verification link has expired. Please request a new one.";
        }
      }

      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Verification Link Expired</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .error { color: #e74c3c; }
                .btn { background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2 class="error">⏰ ${
                  errorMessage.includes("expired")
                    ? "Link Expired"
                    : "Invalid Link"
                }</h2>
                <p>${errorMessage}</p>
                <a href="https://busyvotingsystem.netlify.app" class="btn">← Request New Verification</a>
            </div>
        </body>
        </html>
      `);
    }

    console.log(`Valid verification found for matric: ${verification.matric}`);

    // Double-check if student has already voted
    const alreadyVoted = await Vote.findOne({ matric: verification.matric });
    if (alreadyVoted) {
      console.log(`Student already voted: ${verification.matric}`);
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Already Voted</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .warning { color: #f39c12; }
                .btn { background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2 class="warning">✅ Already Voted</h2>
                <p>You have already cast your vote in this election.</p>
                <a href="https://busyvotingsystem.netlify.app/results" class="btn">View Results</a>
            </div>
        </body>
        </html>
      `);
    }

    // Mark verification as used
    verification.isUsed = true;
    verification.verifiedAt = new Date();
    await verification.save();

    console.log(`Verification completed for matric: ${verification.matric}`);

    // FIXED: Redirect to voting page with verified matric
    const votingUrl = `https://busyvotingsystem.netlify.app/vote?verified=${verification.matric}`;

    console.log(`Redirecting to: ${votingUrl}`);

    res.redirect(votingUrl);
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Verification Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
              .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .error { color: #e74c3c; }
              .btn { background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
          </style>
      </head>
      <body>
          <div class="container">
              <h2 class="error">⚠️ Verification Error</h2>
              <p>An error occurred during email verification. Please try again or request a new verification email.</p>
              <a href="https://busyvotingsystem.netlify.app" class="btn">← Go Back</a>
          </div>
      </body>
      </html>
    `);
  }
});

module.exports = router;
