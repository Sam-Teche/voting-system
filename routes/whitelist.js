const express = require("express");
const { Whitelist, VotingCode } = require("../models");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// GET WHITELIST ROUTE - now includes assigned code info
router.get("/whitelist", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const whitelist = await Whitelist.find({ adminId })
      .select("email matric voted assignedCode assignedAt")
      .sort({ assignedAt: -1 })
      .lean();

    // Get code names for better display
    const codes = await VotingCode.find({ adminId }).select("code name");
    const codeMap = {};
    codes.forEach((code) => {
      codeMap[code.code] = code.name;
    });

    // Add code names to whitelist entries
    const whitelistWithCodeNames = whitelist.map((entry) => ({
      ...entry,
      codeName: codeMap[entry.assignedCode] || "Unknown Code",
    }));

    res.send({
      total: whitelist.length,
      students: whitelistWithCodeNames,
    });
  } catch (error) {
    console.error("Error fetching whitelist:", error);
    res.status(500).send({ message: "Failed to fetch whitelist" });
  }
});

// Add single entry to whitelist - NOW REQUIRES CODE ASSIGNMENT
router.post("/whitelist", verifyToken, async (req, res) => {
  const { email = "", matric, assignedCode } = req.body;
  const adminId = req.user.id;

  if (!matric) {
    return res.status(400).send({ message: "Matric number is required" });
  }

  if (!assignedCode) {
    return res.status(400).send({ message: "Code assignment is required" });
  }

  // Verify the code exists and belongs to this admin
  const votingCode = await VotingCode.findOne({
    code: assignedCode,
    adminId,
  });
  if (!votingCode) {
    return res.status(400).send({
      message: "Invalid voting code for this admin",
    });
  }

  if (!votingCode.isActive) {
    return res.status(400).send({
      message: "Cannot assign to inactive voting code",
    });
  }

  try {
    const newEntry = await Whitelist.create({
      email: email.trim().toLowerCase(),
      matric: matric.trim().toUpperCase(),
      assignedCode: assignedCode.trim(),
      adminId,
      assignedAt: new Date(),
    });

    res.send({
      message: "Student added to whitelist and assigned to code",
      entry: {
        matric: newEntry.matric,
        email: newEntry.email,
        assignedCode: newEntry.assignedCode,
        codeName: votingCode.name,
        assignedAt: newEntry.assignedAt,
      },
    });
  } catch (err) {
    // Handle duplicate matric
    if (err.code === 11000 && err.keyPattern && err.keyPattern.matric) {
      return res.status(400).send({
        message: `Matric ${matric.toUpperCase()} is already whitelisted`,
      });
    }
    console.error("Error adding to whitelist:", err);
    res.status(500).send({
      message: "Error adding to whitelist",
      error: err.message,
    });
  }
});

// Updated bulk add - now requires code assignment for each entry
router.post("/whitelist/bulk", verifyToken, async (req, res) => {
  const { entries, defaultCode } = req.body; // defaultCode for all entries
  const adminId = req.user.id;

  console.log("=== BULK ADD WITH CODES DEBUG ===");
  console.log("Received entries:", entries);
  console.log("Default code:", defaultCode);

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).send({ message: "Invalid or empty entries" });
  }

  // If defaultCode is provided, verify it
  let defaultVotingCode = null;
  if (defaultCode) {
    defaultVotingCode = await VotingCode.findOne({
      code: defaultCode,
      adminId,
    });
    if (!defaultVotingCode) {
      return res.status(400).send({
        message: "Invalid default voting code",
      });
    }
    if (!defaultVotingCode.isActive) {
      return res.status(400).send({
        message: "Default voting code is inactive",
      });
    }
  }

  // Validate all entries first
  const validEntries = [];
  const errors = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const { email, matric, assignedCode } = entry;

    // Use entry's assigned code or default code
    const codeToUse = assignedCode || defaultCode;

    if (!email || !matric) {
      errors.push(`Entry ${i + 1}: Missing email or matric`);
      continue;
    }

    if (!codeToUse) {
      errors.push(
        `Entry ${i + 1}: No code assigned (provide assignedCode or defaultCode)`
      );
      continue;
    }

    if (typeof email !== "string" || typeof matric !== "string") {
      errors.push(`Entry ${i + 1}: Email and matric must be strings`);
      continue;
    }

    // If this entry has a specific code (not using default), verify it
    if (assignedCode && assignedCode !== defaultCode) {
      const specificCode = await VotingCode.findOne({
        code: assignedCode,
        adminId,
      });
      if (!specificCode) {
        errors.push(`Entry ${i + 1}: Invalid assigned code ${assignedCode}`);
        continue;
      }
      if (!specificCode.isActive) {
        errors.push(
          `Entry ${i + 1}: Assigned code ${assignedCode} is inactive`
        );
        continue;
      }
    }

    validEntries.push({
      email: email.trim().toLowerCase(),
      matric: matric.trim().toUpperCase(),
      assignedCode: codeToUse.trim(),
    });
  }

  if (errors.length > 0) {
    return res.status(400).send({
      message: "Validation errors found",
      errors,
    });
  }

  console.log("Valid entries to process:", validEntries);

  // Process entries one by one to handle duplicates gracefully
  const results = {
    created: 0,
    duplicates: 0,
    errors: [],
  };

  for (let i = 0; i < validEntries.length; i++) {
    const { email, matric, assignedCode } = validEntries[i];

    try {
      await Whitelist.create({
        email,
        matric,
        assignedCode,
        adminId,
        assignedAt: new Date(),
      });
      results.created++;
      console.log(
        `Successfully created: ${email}, ${matric}, code: ${assignedCode}`
      );
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate key error
        results.duplicates++;
        console.log(`Duplicate matric: ${matric}`);
      } else {
        // Other errors
        results.errors.push(
          `Entry ${i + 1} (${email}, ${matric}): ${err.message}`
        );
        console.error(`Error creating entry ${i + 1}:`, err);
      }
    }
  }

  // Send detailed response
  const message = [
    `Bulk insert completed.`,
    `Created: ${results.created}`,
    `Duplicates skipped: ${results.duplicates}`,
    results.errors.length > 0 ? `Errors: ${results.errors.length}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const response = {
    message,
    summary: results,
  };

  if (results.errors.length > 0) {
    response.errors = results.errors;
  }

  res.status(200).send(response);
});

// Get students by assigned code
router.get("/whitelist/by-code/:code", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const code = req.params.code;

    // Verify code exists
    const votingCode = await VotingCode.findOne({ code, adminId });
    if (!votingCode) {
      return res.status(404).send({ message: "Code not found" });
    }

    const students = await Whitelist.find({
      assignedCode: code,
      adminId,
    })
      .select("matric email voted assignedAt")
      .sort({ assignedAt: -1 });

    res.send({
      code: {
        code: votingCode.code,
        name: votingCode.name,
        description: votingCode.description,
      },
      studentsCount: students.length,
      students,
    });
  } catch (error) {
    res.status(500).send({
      message: "Error fetching students by code",
      error: error.message,
    });
  }
});

// Get whitelist summary grouped by codes
router.get("/whitelist/summary", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;

    // Get all codes for this admin
    const codes = await VotingCode.find({ adminId }).sort({ createdAt: -1 });

    // Get student counts for each code
    const summary = await Promise.all(
      codes.map(async (code) => {
        const students = await Whitelist.find({
          assignedCode: code.code,
          adminId,
        });

        const totalStudents = students.length;
        const votedStudents = students.filter((s) => s.voted).length;
        const pendingStudents = totalStudents - votedStudents;

        return {
          code: code.code,
          name: code.name,
          description: code.description,
          isActive: code.isActive,
          totalStudents,
          votedStudents,
          pendingStudents,
          createdAt: code.createdAt,
        };
      })
    );

    // Get unassigned students (those with empty or invalid codes)
    const unassignedStudents = await Whitelist.find({
      $or: [{ assignedCode: "" }, { assignedCode: { $exists: false } }],
      adminId,
    });

    // Get overall statistics
    const totalStudents = await Whitelist.countDocuments({ adminId });
    const totalVoted = await Whitelist.countDocuments({ adminId, voted: true });
    const totalPending = totalStudents - totalVoted;

    res.send({
      overallStats: {
        totalStudents,
        totalVoted,
        totalPending,
        unassignedCount: unassignedStudents.length,
      },
      codesSummary: summary,
      unassignedStudents: unassignedStudents.map((student) => ({
        matric: student.matric,
        email: student.email,
        voted: student.voted,
        assignedAt: student.assignedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching whitelist summary:", error);
    res.status(500).send({
      message: "Error fetching summary",
      error: error.message,
    });
  }
});

// Update student's assigned code
router.put("/whitelist/:matric", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const matric = req.params.matric.toUpperCase();
    const { assignedCode, email } = req.body;

    if (!assignedCode) {
      return res.status(400).send({ message: "Assigned code is required" });
    }

    // Verify the code exists and is active
    const votingCode = await VotingCode.findOne({
      code: assignedCode,
      adminId,
    });
    if (!votingCode) {
      return res.status(400).send({
        message: "Invalid voting code",
      });
    }

    if (!votingCode.isActive) {
      return res.status(400).send({
        message: "Cannot assign to inactive voting code",
      });
    }

    // Find and update the student
    const student = await Whitelist.findOne({ matric, adminId });
    if (!student) {
      return res.status(404).send({
        message: "Student not found in whitelist",
      });
    }

    // Check if student has already voted - prevent reassignment after voting
    if (student.voted) {
      return res.status(400).send({
        message: "Cannot reassign student who has already voted",
      });
    }

    const previousCode = student.assignedCode;

    // Update the student
    student.assignedCode = assignedCode;
    student.assignedAt = new Date();
    if (email !== undefined) {
      student.email = email.trim().toLowerCase();
    }

    await student.save();

    const message =
      previousCode !== assignedCode
        ? `Student reassigned from code ${previousCode} to ${assignedCode}`
        : `Student updated successfully`;

    res.send({
      message,
      student: {
        matric: student.matric,
        email: student.email,
        assignedCode: student.assignedCode,
        codeName: votingCode.name,
        voted: student.voted,
        assignedAt: student.assignedAt,
      },
    });
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(500).send({
      message: "Error updating student",
      error: error.message,
    });
  }
});

// Remove student from whitelist completely
router.delete("/whitelist/:matric", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const matric = req.params.matric.toUpperCase();

    const student = await Whitelist.findOne({ matric, adminId });
    if (!student) {
      return res.status(404).send({
        message: "Student not found in whitelist",
      });
    }

    // Check if student has voted - prevent deletion after voting
    if (student.voted) {
      return res.status(400).send({
        message: "Cannot delete student who has already voted",
      });
    }

    await Whitelist.deleteOne({ _id: student._id });

    res.send({
      message: "Student removed from whitelist",
      removedStudent: {
        matric: student.matric,
        email: student.email,
        assignedCode: student.assignedCode,
      },
    });
  } catch (error) {
    console.error("Error removing student:", error);
    res.status(500).send({
      message: "Error removing student",
      error: error.message,
    });
  }
});

// Bulk reassign students to a new code
router.post("/whitelist/bulk-reassign", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const { matricNumbers, newCode } = req.body;

    if (!Array.isArray(matricNumbers) || matricNumbers.length === 0) {
      return res.status(400).send({
        message: "Matric numbers array is required",
      });
    }

    if (!newCode) {
      return res.status(400).send({
        message: "New code is required",
      });
    }

    // Verify the new code exists and is active
    const votingCode = await VotingCode.findOne({
      code: newCode,
      adminId,
    });
    if (!votingCode) {
      return res.status(400).send({
        message: "Invalid voting code",
      });
    }

    if (!votingCode.isActive) {
      return res.status(400).send({
        message: "Cannot assign to inactive voting code",
      });
    }

    const results = {
      reassigned: 0,
      notFound: [],
      alreadyVoted: [],
      errors: [],
    };

    for (const matric of matricNumbers) {
      try {
        const matricUpper = matric.trim().toUpperCase();
        const student = await Whitelist.findOne({
          matric: matricUpper,
          adminId,
        });

        if (!student) {
          results.notFound.push(matricUpper);
          continue;
        }

        if (student.voted) {
          results.alreadyVoted.push(matricUpper);
          continue;
        }

        // Skip if already assigned to this code
        if (student.assignedCode === newCode) {
          continue;
        }

        student.assignedCode = newCode;
        student.assignedAt = new Date();
        await student.save();

        results.reassigned++;
      } catch (error) {
        results.errors.push(`${matric}: ${error.message}`);
      }
    }

    res.send({
      message: "Bulk reassignment completed",
      results,
      newCode: {
        code: votingCode.code,
        name: votingCode.name,
      },
    });
  } catch (error) {
    console.error("Error in bulk reassign:", error);
    res.status(500).send({
      message: "Error during bulk reassignment",
      error: error.message,
    });
  }
});

// Get unassigned students (those without valid codes)
router.get("/whitelist/unassigned", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;

    // Get all valid codes for this admin
    const validCodes = await VotingCode.find({ adminId }).select("code");
    const validCodesList = validCodes.map((c) => c.code);

    // Find students with invalid or missing codes
    const unassignedStudents = await Whitelist.find({
      adminId,
      $or: [
        { assignedCode: "" },
        { assignedCode: { $exists: false } },
        { assignedCode: { $nin: validCodesList } },
      ],
    })
      .select("matric email voted assignedCode assignedAt")
      .sort({ assignedAt: -1 });

    res.send({
      count: unassignedStudents.length,
      students: unassignedStudents,
    });
  } catch (error) {
    console.error("Error fetching unassigned students:", error);
    res.status(500).send({
      message: "Error fetching unassigned students",
      error: error.message,
    });
  }
});

module.exports = router;
