// First, install required packages:
// npm install nodemailer crypto

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
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
const votingRoutes = require("./routes/voting"); // ✅ NEW route

// Use routes
app.use("/api/admin", adminRoutes);
app.use("/api/student", studentRoutes);
app.use("/api", candidateRoutes);
app.use("/api/admin", whitelistRoutes);
app.use("/api/admin", linkRoutes);
app.use("/api/admin", resultRoutes);
app.use("/api", votingRoutes); // ✅ Use the /verify-student endpoint here

// START SERVER
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
