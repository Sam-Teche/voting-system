const mongoose = require("mongoose");

// SCHEMAS
const AdminSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  institution: String,
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

// UPDATED: Added name field for custom naming
const VotingCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    length: 5,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    default: function () {
      return `Code-${this.code}`;
    },
  },
  description: {
    type: String,
    default: "",
    trim: true,
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  studentsCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// UPDATED: Modified whitelist to ensure code assignment is required
const WhitelistSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      default: "",
      required: true,
      trim: true,
      lowercase: true,
    },
    matric: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    voted: {
      type: Boolean,
      default: false,
    },
    assignedCode: {
      type: String,
      required: true, // NOW REQUIRED - every student must be assigned to a code
      trim: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        ret.email = ret.email || "";
        return ret;
      },
    },
  }
);

// Create compound index to ensure one student per code per admin
WhitelistSchema.index({ matric: 1, adminId: 1 }, { unique: true });
WhitelistSchema.index({ assignedCode: 1, adminId: 1 });

const CandidateSchema = new mongoose.Schema({
  name: String,
  post: String, // This is the position (President, Secretary, etc.)
  description: String,
  votes: { type: Number, default: 0 },
  adminId: mongoose.Schema.Types.ObjectId,
});

// Updated VoteSchema to support voting for multiple positions
const VoteSchema = new mongoose.Schema({
  matric: String,
  candidateId: mongoose.Schema.Types.ObjectId,
  position: String,
  adminId: mongoose.Schema.Types.ObjectId,
  codeUsed: String, // Track which code was used for this vote
  timestamp: { type: Date, default: Date.now },
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
const VotingCode = mongoose.model("VotingCode", VotingCodeSchema);

module.exports = {
  Admin,
  StudentVerification,
  Whitelist,
  Candidate,
  Vote,
  Link,
  VotingCode,
};
