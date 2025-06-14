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
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const hashed = await bcrypt.hash(password, 10);

  const admin = await Admin.create({
    email,
    password: hashed,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: verificationExpires,
  });

  // Send verification email
  const verificationUrl = `${req.protocol}://${req.get(
    "host"
  )}/api/admin/verify-email/${verificationToken}`;

  const emailHtml = `
    <h2>Verify Your Admin Account</h2>
    <p>Please click the link below to verify your email address:</p>
    <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;">Verify Email</a>
    <p>This link will expire in 24 hours.</p>
    <p>If you didn't create this account, please ignore this email.</p>
  `;

  const emailSent = await sendEmail(
    email,
    "Verify Your Admin Account",
    emailHtml
  );

  if (!emailSent) {
    await Admin.findByIdAndDelete(admin._id);
    return res
      .status(500)
      .send({ message: "Failed to send verification email" });
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

  /*if (!admin.isEmailVerified) {
    return res
      .status(400)
      .send({ message: "Please verify your email before logging in" });
  }*/

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) return res.status(400).send({ message: "Invalid credentials" });

  const token = jwt.sign({ id: admin._id }, JWT_SECRET);
  res.send({ message: "Login successful", token });
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
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  admin.emailVerificationToken = verificationToken;
  admin.emailVerificationExpires = verificationExpires;
  await admin.save();

  // Send verification email
  const verificationUrl = `${req.protocol}://${req.get(
    "host"
  )}/api/admin/verify-email/${verificationToken}`;

  const emailHtml = `
    <h2>Verify Your Admin Account</h2>
    <p>Please click the link below to verify your email address:</p>
    <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;">Verify Email</a>
    <p>This link will expire in 24 hours.</p>
  `;

  const emailSent = await sendEmail(
    email,
    "Verify Your Admin Account",
    emailHtml
  );

  if (!emailSent) {
    return res
      .status(500)
      .send({ message: "Failed to send verification email" });
  }

  res.send({ message: "Verification email resent successfully" });
});

module.exports = router;
