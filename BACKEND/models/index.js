const mongoose = require("mongoose");

// SCHEMAS
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
  matric: { type: String, required: true, unique: true },
  voted: { type: Boolean, default: false }, // ✅ required for tracking votes
});

const CandidateSchema = new mongoose.Schema({
  name: String,
  post: String, // This is the position (President, Secretary, etc.)
  description: String,
  votes: { type: Number, default: 0 },
  adminId: mongoose.Schema.Types.ObjectId, // Added to track which admin added the candidate
});

// Updated VoteSchema to support voting for multiple positions
const VoteSchema = new mongoose.Schema({
  matric: String, // Removed unique constraint
  candidateId: mongoose.Schema.Types.ObjectId,
  position: String, // Added to track which position this vote is for
  adminId: mongoose.Schema.Types.ObjectId, // Added for consistency
  timestamp: { type: Date, default: Date.now }, // Added to track when vote was cast
});

// Compound unique index: one vote per student per position
VoteSchema.index({ matric: 1, position: 1 }, { unique: true });

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

module.exports = {
  Admin,
  StudentVerification,
  Whitelist,
  Candidate,
  Vote,
  Link,
};
