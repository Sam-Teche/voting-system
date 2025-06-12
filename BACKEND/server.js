// First, install required packages:
// npm install nodemailer crypto

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

// Load environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// Email configuration - Add these to your .env file
const EMAIL_USER = process.env.EMAIL_USER; // your email
const EMAIL_PASS = process.env.EMAIL_PASS; // your email password or app password
const EMAIL_HOST = process.env.EMAIL_HOST || "smtp.gmail.com"; // or your email provider's SMTP
const EMAIL_PORT = process.env.EMAIL_PORT || 587;

// Create nodemailer transporter
const transporter = nodemailer.createTransporter({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

// UPDATED SCHEMAS
const AdminSchema = new mongoose.Schema({
  email: String,
  password: String,
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
});

const StudentVerificationSchema = new mongoose.Schema({
  email: String,
  matric: String,
  verificationToken: String,
  verificationExpires: Date,
  isUsed: { type: Boolean, default: false },
});

const WhitelistSchema = new mongoose.Schema({
  matric: { type: String, unique: true },
});

const CandidateSchema = new mongoose.Schema({
  name: String,
  post: String,
  description: String,
  votes: { type: Number, default: 0 },
});

const VoteSchema = new mongoose.Schema({
  matric: { type: String, unique: true },
  candidateId: mongoose.Schema.Types.ObjectId,
});

const LinkSchema = new mongoose.Schema({
  url: String,
  created: { type: Date, default: Date.now },
});

// MODELS
const Admin = mongoose.model("Admin", AdminSchema);
const StudentVerification = mongoose.model(
  "StudentVerification",
  StudentVerificationSchema
);
const Whitelist = mongoose.model("Whitelist", WhitelistSchema);
const Candidate = mongoose.model("Candidate", CandidateSchema);
const Vote = mongoose.model("Vote", VoteSchema);
const Link = mongoose.model("Link", LinkSchema);

// Email sending function
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: EMAIL_USER,
      to: to,
      subject: subject,
      html: html,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};

// JWT Middleware
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).send({ message: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).send({ message: "Invalid token" });
    req.userId = decoded.id;
    next();
  });
};

// UPDATED ROUTES

// Admin Signup with Email Verification
app.post("/api/admin/signup", async (req, res) => {
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
app.get("/api/admin/verify-email/:token", async (req, res) => {
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
app.post("/api/admin/login", async (req, res) => {
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

// Send verification email to student
app.post("/api/student/send-verification", async (req, res) => {
  const { email, matric } = req.body;

  if (!matric.startsWith("SVG")) {
    return res
      .status(400)
      .send({ message: "Matric number must start with SVG" });
  }

  // Check if student is whitelisted
  const found = await Whitelist.findOne({ matric });
  if (!found) {
    return res
      .status(400)
      .send({
        message: "You are not a student of Surveying and Geo-Informatics",
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
app.get("/api/student/verify-email/:token", async (req, res) => {
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
app.post("/api/student/login", async (req, res) => {
  const { email, matric } = req.body;

  if (!matric.startsWith("SVG")) {
    return res
      .status(400)
      .send({ message: "Matric number must start with SVG" });
  }

  const found = await Whitelist.findOne({ matric });
  if (!found) {
    return res
      .status(400)
      .send({
        message: "You are not a student of Surveying and Geo-Informatics",
      });
  }

  const alreadyVoted = await Vote.findOne({ matric });
  if (alreadyVoted) {
    return res.status(400).send({ message: "You have already voted" });
  }

  res.send({ message: "Login successful" });
});

// Updated Voting endpoint (check verification if needed)
app.post("/api/vote", async (req, res) => {
  const { matric, candidateId, verified } = req.body;

  // If verified parameter is provided, check if it's valid
  if (verified) {
    const verification = await StudentVerification.findOne({
      matric: verified,
      isUsed: true,
    });

    if (!verification || verification.matric !== matric) {
      return res.status(400).send({ message: "Invalid verification" });
    }
  }

  const alreadyVoted = await Vote.findOne({ matric });
  if (alreadyVoted) {
    return res.status(400).send({ message: "You have already voted" });
  }

  const candidate = await Candidate.findById(candidateId);
  if (!candidate) {
    return res.status(400).send({ message: "Candidate not found" });
  }

  await Vote.create({ matric, candidateId });
  candidate.votes += 1;
  await candidate.save();

  res.send({ message: "Vote recorded successfully" });
});

// Resend Admin Verification Email
app.post("/api/admin/resend-verification", async (req, res) => {
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

// Rest of your existing routes remain the same...
// (candidates, voting, whitelist, generate-link, results routes)

// Candidates
app.get("/api/candidates", async (req, res) => {
  const candidates = await Candidate.find();
  res.send(candidates);
});

app.post("/api/admin/candidates", verifyToken, async (req, res) => {
  const { name, post, description } = req.body;
  await Candidate.create({ name, post, description });
  res.send({ message: "Candidate added" });
});

app.delete("/api/admin/candidates/:id", verifyToken, async (req, res) => {
  await Candidate.findByIdAndDelete(req.params.id);
  res.send({ message: "Candidate removed" });
});

// Whitelist
app.get("/api/admin/whitelist", verifyToken, async (req, res) => {
  const whitelist = await Whitelist.find().select("matric");
  res.send(whitelist.map((w) => w.matric));
});

app.post("/api/admin/whitelist", verifyToken, async (req, res) => {
  const { matric } = req.body;
  await Whitelist.create({ matric });
  res.send({ message: "Matric added to whitelist" });
});

app.post("/api/admin/whitelist/bulk", verifyToken, async (req, res) => {
  const { matricNumbers } = req.body;
  const bulkInsert = matricNumbers.map((matric) => ({ matric }));
  await Whitelist.insertMany(bulkInsert, { ordered: false }).catch(() => {});
  res.send({ message: "Bulk insert completed" });
});

app.delete("/api/admin/whitelist/:matric", verifyToken, async (req, res) => {
  await Whitelist.deleteOne({ matric: req.params.matric });
  res.send({ message: "Matric removed" });
});

// Generate Link
app.post("/api/admin/generate-link", verifyToken, async (req, res) => {
  const url = `https://extraordinary-sprite-215820.netlify.app/vote/${uuidv4()}`;
  await Link.create({ url });
  res.send({ message: "Link generated successfully" });
});

app.get("/api/admin/links", verifyToken, async (req, res) => {
  const links = await Link.find();
  res.send(links);
});

// Results
app.get("/api/admin/results", verifyToken, async (req, res) => {
  const candidates = await Candidate.find();
  const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
  res.send({
    candidates: candidates.map((c) => ({
      name: c.name,
      post: c.post,
      votes: c.votes,
      percentage:
        totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(2) : "0.00",
    })),
    totalVotes,
  });
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
