const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Admin } = require("../models");
const { sendEmail } = require("../utils/email");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Admin Signup with Email Verification
router.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  const existing = await Admin.findOne({ email });
  if (existing) {
    return res.status(400).send({ message: "Admin already exists" });
  }

  if (password.length < 8) {
    return res.status(400).send({ message: "Password too short" });
  }

  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  console.log("⏳ Token will expire at:", verificationExpires.toLocaleString());

  const hashed = await bcrypt.hash(password, 10);

  const admin = await Admin.create({
    email,
    password: hashed,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: verificationExpires,
  });

  // Send verification email
  const verificationUrl = `https://voting-backend-yf6o.onrender.com/api/admin/verify-email/${verificationToken}`;
  console.log("📩 Attempting to send email to:", email);
  console.log("🔗 Verification link:", verificationUrl);
  const emailHtml = `
  <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2 style="color: #4CAF50;">Verify Your Admin Account</h2>
    <p>Hello,</p>
    <p>Please click the button below to verify your email address:</p>
    <a href="${verificationUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; margin-top: 10px;">Verify Email</a>
    <p style="margin-top: 20px;">This link will expire on <strong>${verificationExpires.toLocaleString()}</strong>.</p>
    <p>If you didn't create this account, you can ignore this email.</p>
    <hr style="margin-top: 30px;" />
    <small style="color: #777;">Voting System • ${new Date().getFullYear()}</small>
  </div>
`;

  const emailSent = await sendEmail(
    email,
    "Verify Your Admin Account",
    emailHtml
  );
  console.log("📨 Email sent status:", emailSent);

  if (!emailSent) {
    console.warn("⚠️ Verification email failed. Manually send this link:");
    console.warn("🔗", verificationUrl);
    console.warn("🕒 Expires at:", verificationExpires.toLocaleString());

    return res.status(500).send({
      message:
        "Failed to send verification email. Admin not deleted so you can try resending.",
      manualLink: verificationUrl,
      expiresAt: verificationExpires,
    });
  }
  res.send({
    message:
      "Admin registered. Please check your email to verify your account.",
  });
});

// Admin Email Verification
router.get("/verify-email/:token", async (req, res) => {
  const { token } = req.params;

  const admin = await Admin.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!admin) {
    return res.status(400).send("Invalid or expired verification token");
  }

  admin.isEmailVerified = true;
  admin.emailVerificationToken = undefined;
  admin.emailVerificationExpires = undefined;
  await admin.save();

  res.send(`
    <html>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h2 style="color: #4CAF50;">Email Verified Successfully!</h2>
        <p>Your admin account has been verified. You can now log in.</p>
        <a href="https://extraordinary-sprite-215820.netlify.app/admin/login" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Go to Login</a>
      </body>
    </html>
  `);
});

// Updated Admin Login (check email verification)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin) return res.status(400).send({ message: "Admin not found" });
  

  if (!admin.isEmailVerified) {
    return res
      .status(400)
      .send({ message: "Please verify your email before logging in" });
  }

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) return res.status(400).send({ message: "Invalid credentials" });

  const token = jwt.sign({ id: admin._id }, JWT_SECRET);
  res.send({ message: "Login successful", token });
});

router.get("/test-email", async (req, res) => {
  const sent = await sendEmail(
    "ogunrindesam@gmail.com",
    "Test",
    "<h1>Hello</h1>"
  );
  if (sent) return res.send("Email sent successfully");
  return res.status(500).send("Email failed");
});



// Resend Admin Verification Email
router.post("/resend-verification", async (req, res) => {
  const { email } = req.body;

  const admin = await Admin.findOne({ email, isEmailVerified: false });
  if (!admin) {
    return res
      .status(400)
      .send({ message: "Admin not found or already verified" });
  }

  // Generate new verification token
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  console.log("⏳ Token will expire at:", verificationExpires.toLocaleString());
  admin.emailVerificationToken = verificationToken;
  admin.emailVerificationExpires = verificationExpires;
  await admin.save();

  // Send verification email
  const verificationUrl = `https://voting-backend-yf6o.onrender.com/api/admin/verify-email/${verificationToken}`;
  console.log("📩 Attempting to send email to:", email);
  console.log("🔗 Verification link:", verificationUrl);
  const emailHtml = `
  <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2 style="color: #4CAF50;">Verify Your Admin Account</h2>
    <p>Hello,</p>
    <p>Please click the button below to verify your email address:</p>
    <a href="${verificationUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; margin-top: 10px;">Verify Email</a>
    <p style="margin-top: 20px;">This link will expire on <strong>${verificationExpires.toLocaleString()}</strong>.</p>
    <p>If you didn't create this account, you can ignore this email.</p>
    <hr style="margin-top: 30px;" />
    <small style="color: #777;">Voting System • ${new Date().getFullYear()}</small>
  </div>
`;

  const emailSent = await sendEmail(
    email,
    "Verify Your Admin Account",
    emailHtml
  );
  console.log("📨 Email sent status:", emailSent);

  if (!emailSent) {
    console.warn("⚠️ Verification email failed. Manually send this link:");
    console.warn("🔗", verificationUrl);
    console.warn("🕒 Expires at:", verificationExpires.toLocaleString());

    return res.status(500).send({
      message:
        "Failed to send verification email. Admin not deleted so you can try resending.",
      manualLink: verificationUrl,
      expiresAt: verificationExpires,
    });
  }

  res.send({ message: "Verification email resent successfully" });
});

module.exports = router;
