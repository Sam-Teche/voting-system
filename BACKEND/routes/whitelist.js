const express = require("express");
const { Whitelist } = require("../models");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// ✅ GET WHITELIST ROUTE
router.get("/whitelist", verifyToken, async (req, res) => {
  try {
    const whitelist = await Whitelist.find().lean(); // Get plain JavaScript objects

    // Normalize the data structure
    const normalizedWhitelist = whitelist.map((entry) => ({
      _id: entry._id,
      email: entry.email || "", // Ensure email exists, default to empty string
      matric: entry.matric,
      voted: entry.voted || false, // Ensure voted exists
    }));

    console.log("Normalized whitelist data:", normalizedWhitelist);
    res.send(normalizedWhitelist);
  } catch (error) {
    console.error("Whitelist fetch error:", error);
    res.status(500).send({ message: "Failed to fetch whitelist" });
  }
});


// Add single entry to whitelist (admin only) - WITH DEBUG
router.post("/whitelist", verifyToken, async (req, res) => {
  // Destructure with defaults
  const { email = "", matric } = req.body;

  if (!matric) {
    // Only matric is truly required now
    return res.status(400).send({ message: "Matric number is required" });
  }

  try {
    const newEntry = await Whitelist.create({
      email: email.trim().toLowerCase(),
      matric: matric.trim().toUpperCase(),
    });

    res.send({
      message: "Student added to whitelist",
      entry: {
        _id: newEntry._id,
        email: newEntry.email || "",
        matric: newEntry.matric,
        voted: newEntry.voted || false,
      },
    });
  } catch (err) {
    // ... existing error handling
  }
});

// Bulk add to whitelist (admin only)
// Bulk add to whitelist (admin only) - FIXED VERSION
router.post("/whitelist/bulk", verifyToken, async (req, res) => {
  const { entries } = req.body;

  console.log("=== BULK ADD DEBUG ===");
  console.log("Received entries:", entries);

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).send({ message: "Invalid or empty entries" });
  }

  // Validate all entries first
  const validEntries = [];
  const errors = [];

  entries.forEach((entry, index) => {
    const { email, matric } = entry;

    if (!email || !matric) {
      errors.push(`Entry ${index + 1}: Missing email or matric`);
      return;
    }

    if (typeof email !== "string" || typeof matric !== "string") {
      errors.push(`Entry ${index + 1}: Email and matric must be strings`);
      return;
    }

    // In your bulk upload route, add this validation:
    validEntries.push({
      email: (email || "").trim().toLowerCase(), // Handle undefined email
      matric: matric.trim().toUpperCase(),
    });
  });

  if (errors.length > 0) {
    return res.status(400).send({ 
      message: "Validation errors found", 
      errors 
    });
  }

  res.status(400).send({
    message: "Validation failed",
    details: {
      missingFields:
        !email && !matric
          ? ["email", "matric"]
          : !email
          ? ["email"]
          : ["matric"],
      received: { email, matric },
    },
  });


  console.log("Valid entries to process:", validEntries);

  // Process entries one by one to handle duplicates gracefully
  const results = {
    created: 0,
    duplicates: 0,
    errors: []
  };

  for (let i = 0; i < validEntries.length; i++) {
    const { email, matric } = validEntries[i];
    
    try {
      await Whitelist.create({ email, matric });
      results.created++;
      console.log(`Successfully created: ${email}, ${matric}`);
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate key error
        results.duplicates++;
        const field = Object.keys(err.keyPattern)[0];
        console.log(`Duplicate ${field}: ${field === 'email' ? email : matric}`);
      } else {
        // Other errors
        results.errors.push(`Entry ${i + 1} (${email}, ${matric}): ${err.message}`);
        console.error(`Error creating entry ${i + 1}:`, err);
      }
    }
  }

  // Send detailed response
  const message = [
    `Bulk insert completed.`,
    `Created: ${results.created}`,
    `Duplicates skipped: ${results.duplicates}`,
    results.errors.length > 0 ? `Errors: ${results.errors.length}` : null
  ].filter(Boolean).join(', ');

  const response = {
    message,
    summary: results
  };

  if (results.errors.length > 0) {
    response.errors = results.errors;
  }

  res.status(200).send(response);
});

// Remove matric from whitelist (admin only)
router.delete("/whitelist/:matric", verifyToken, async (req, res) => {
  try {
    const result = await Whitelist.deleteOne({ matric: req.params.matric });
    console.log("Delete result:", result);
    res.send({ message: "Matric removed" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).send({ message: "Error removing matric" });
  }
});

// Debug route to see raw database entries
router.get("/whitelist/debug", verifyToken, async (req, res) => {
  try {
    const whitelist = await Whitelist.find(); // Get ALL fields
    console.log("Raw database entries:");
    whitelist.forEach((entry, index) => {
      console.log(`Entry ${index}:`, {
        _id: entry._id,
        email: entry.email,
        matric: entry.matric,
        voted: entry.voted,
        fullObject: entry.toObject(),
      });
    });
    res.json({ count: whitelist.length, entries: whitelist });
  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Cleanup route to remove entries without emails
router.post("/whitelist/cleanup", verifyToken, async (req, res) => {
  try {
    const query = {
      $or: [
        { email: { $exists: false } },
        { email: null },
        { email: "" },
        { email: "undefined" }, // catch bad strings too
      ],
    };

    const toDelete = await Whitelist.find(query);
    console.log(
      "Will delete:",
      toDelete.map((e) => ({
        _id: e._id,
        matric: e.matric,
        email: e.email,
      }))
    );

    const result = await Whitelist.deleteMany(query);

    console.log("Cleanup result:", result);
    res.json({
      message: `Removed ${result.deletedCount} entries without valid emails.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    res.status(500).json({ error: error.message });
  }
});


router.get("/whitelist/raw-debug", verifyToken, async (req, res) => {
  try {
    const whitelist = await Whitelist.find().lean(); // Get raw documents

    const analysis = {
      total: whitelist.length,
      withEmail: whitelist.filter((w) => w.email && w.email.trim() !== "")
        .length,
      withoutEmail: whitelist.filter((w) => !w.email || w.email.trim() === "")
        .length,
      samples: whitelist.slice(0, 5).map((w) => ({
        _id: w._id,
        email: w.email,
        emailType: typeof w.email,
        matric: w.matric,
        voted: w.voted,
      })),
    };

    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// In your backend routes
router.post("/whitelist/migrate-emails", verifyToken, async (req, res) => {
  try {
    // Find entries with missing/null/empty emails
    const entries = await Whitelist.find({
      $or: [
        { email: { $exists: false } },
        { email: null },
        { email: "" }
      ]
    });

    // Update them with empty string
    const updates = entries.map(entry => 
      Whitelist.updateOne(
        { _id: entry._id },
        { $set: { email: "" } }
      )
    );

    await Promise.all(updates);

    res.json({
      message: `Migrated ${entries.length} entries`,
      count: entries.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


