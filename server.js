// File: server.js
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

// Replace with your MongoDB connection string
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// SCHEMAS
const AdminSchema = new mongoose.Schema({
  email: String,
  password: String,
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
const Whitelist = mongoose.model("Whitelist", WhitelistSchema);
const Candidate = mongoose.model("Candidate", CandidateSchema);
const Vote = mongoose.model("Vote", VoteSchema);
const Link = mongoose.model("Link", LinkSchema);

// JWT Middleware
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).send({ message: "Unauthorized" });

  jwt.verify(token, "secretkey", (err, decoded) => {
    if (err) return res.status(401).send({ message: "Invalid token" });
    req.userId = decoded.id;
    next();
  });
};

// ROUTES

// Admin Signup
app.post("/api/admin/signup", async (req, res) => {
  const { email, password } = req.body;
  const existing = await Admin.findOne({ email });
  if (existing)
    return res.status(400).send({ message: "Admin already exists" });

  const hashed = await bcrypt.hash(password, 10);
  await Admin.create({ email, password: hashed });

  res.send({ message: "Admin registered successfully" });
});

// Admin Login
app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email });
  if (!admin) return res.status(400).send({ message: "Admin not found" });

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) return res.status(400).send({ message: "Invalid credentials" });

  const token = jwt.sign({ id: admin._id }, "secretkey");
  res.send({ message: "Login successful", token });
});

// Student Login
app.post("/api/student/login", async (req, res) => {
  const { email, matric } = req.body;

  if (!matric.startsWith("SVG")) {
    return res
      .status(400)
      .send({ message: "Matric number must start with SVG" });
  }

  const found = await Whitelist.findOne({ matric });
  if (!found) {
    return res.status(400).send({ message: "Matric number not whitelisted" });
  }

  const alreadyVoted = await Vote.findOne({ matric });
  if (alreadyVoted) {
    return res.status(400).send({ message: "You have already voted" });
  }

  res.send({ message: "Login successful" });
});

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

// Voting
app.post("/api/vote", async (req, res) => {
  const { matric, candidateId } = req.body;

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
  const url = `https://your-domain.com/vote/${uuidv4()}`;
  await Link.create({ url });
  res.send({ message: "Link generated successfully" });
});

app.get("/api/admin/links", verifyToken, async (req, res) => {
  const links = await Link.find();
  res.send(links);
});

// Results
app.get("/api/results", async (req, res) => {
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
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
