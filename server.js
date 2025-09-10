// First, install required packages:
// npm install nodemailer crypto

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ✅ UPDATED: Allow multiple origins for development and production
const allowedOrigins = [
  "https://busyvotingsystem.netlify.app", // Production
  "http://127.0.0.1:5500", // Your current Live Server
  "http://localhost:5500", // Alternative localhost
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

// Load environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Import routes
const adminRoutes = require("./routes/admin");
const studentRoutes = require("./routes/student");
const candidateRoutes = require("./routes/candidates");
const whitelistRoutes = require("./routes/whitelist");
const linkRoutes = require("./routes/links");
const resultRoutes = require("./routes/results");
const votingRoutes = require("./routes/voting");
const votingcodeRoutes = require("./routes/votingcode");
const deleteadminRoutes = require("./routes/deleteadmin");

// Use routes
app.use("/api/admin", adminRoutes);
app.use("/api/student", studentRoutes);
app.use("/api", candidateRoutes);
app.use("/api/admin", whitelistRoutes);
app.use("/api/admin", linkRoutes);
app.use("/api/admin", resultRoutes);
app.use("/api", votingRoutes);
app.use("/api/admin", votingcodeRoutes);
app.use("/api/admin", deleteadminRoutes);

// START SERVER
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ✅ Optional: Add a test endpoint to verify CORS is working
app.get("/api/test-cors", (req, res) => {
  res.json({
    message: "CORS is working!",
    origin: req.get("Origin"),
    timestamp: new Date().toISOString(),
  });
});
