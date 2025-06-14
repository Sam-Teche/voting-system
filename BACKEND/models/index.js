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

module.exports = {
  Admin,
  StudentVerification,
  Whitelist,
  Candidate,
  Vote,
  Link,
};
