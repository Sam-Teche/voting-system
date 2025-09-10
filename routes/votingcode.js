const express = require("express");
const { VotingCode, Whitelist } = require("../models");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Generate a unique 5-digit voting code with custom name
router.post("/voting-codes", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const { name, description = "" } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).send({ message: "Code name is required" });
    }

    // Check if name already exists for this admin
    const existingName = await VotingCode.findOne({
      name: name.trim(),
      adminId,
    });
    if (existingName) {
      return res.status(400).send({
        message: "A code with this name already exists",
      });
    }

    // Generate random 5-digit code
    let code;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = Math.floor(10000 + Math.random() * 90000).toString();
      attempts++;

      if (attempts > maxAttempts) {
        return res.status(500).send({
          message: "Failed to generate unique code. Please try again.",
        });
      }
    } while (await VotingCode.findOne({ code, adminId }));

    const newCode = await VotingCode.create({
      code,
      name: name.trim(),
      description: description.trim(),
      adminId,
    });

    res.send({
      message: "Named voting code generated successfully",
      votingCode: {
        id: newCode._id,
        code: newCode.code,
        name: newCode.name,
        description: newCode.description,
        studentsCount: newCode.studentsCount,
        isActive: newCode.isActive,
        createdAt: newCode.createdAt,
      },
    });
  } catch (err) {
    res.status(500).send({
      message: "Error generating code",
      error: err.message,
    });
  }
});

// List all voting codes for this admin with student counts
router.get("/voting-codes", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const codes = await VotingCode.find({ adminId }).sort({ createdAt: -1 });

    // Get actual student counts for each code
    const codesWithCounts = await Promise.all(
      codes.map(async (code) => {
        const studentCount = await Whitelist.countDocuments({
          assignedCode: code.code,
          adminId,
        });

        return {
          id: code._id,
          code: code.code,
          name: code.name,
          description: code.description,
          studentsCount: studentCount,
          isActive: code.isActive,
          createdAt: code.createdAt,
        };
      })
    );

    res.send({
      total: codes.length,
      codes: codesWithCounts,
    });
  } catch (err) {
    res.status(500).send({
      message: "Error fetching codes",
      error: err.message,
    });
  }
});

// Update voting code name/description
router.put("/voting-codes/:code", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const codeValue = req.params.code;
    const { name, description, isActive } = req.body;

    const votingCode = await VotingCode.findOne({ code: codeValue, adminId });
    if (!votingCode) {
      return res.status(404).send({
        message: "Code not found or not owned by admin",
      });
    }

    // Check if new name conflicts with existing names (if name is being updated)
    if (name && name.trim() !== votingCode.name) {
      const existingName = await VotingCode.findOne({
        name: name.trim(),
        adminId,
        _id: { $ne: votingCode._id },
      });
      if (existingName) {
        return res.status(400).send({
          message: "A code with this name already exists",
        });
      }
    }

    // Update fields
    if (name) votingCode.name = name.trim();
    if (description !== undefined) votingCode.description = description.trim();
    if (isActive !== undefined) votingCode.isActive = isActive;

    await votingCode.save();

    // Get current student count
    const studentCount = await Whitelist.countDocuments({
      assignedCode: codeValue,
      adminId,
    });

    res.send({
      message: "Code updated successfully",
      votingCode: {
        id: votingCode._id,
        code: votingCode.code,
        name: votingCode.name,
        description: votingCode.description,
        studentsCount: studentCount,
        isActive: votingCode.isActive,
        createdAt: votingCode.createdAt,
      },
    });
  } catch (err) {
    res.status(500).send({
      message: "Error updating code",
      error: err.message,
    });
  }
});

// Assign students to a voting code (BULK)
router.post(
  "/voting-codes/:code/assign-bulk",
  verifyToken,
  async (req, res) => {
    try {
      const adminId = req.user.id;
      const codeValue = req.params.code;
      const { matricNumbers } = req.body; // Array of matric numbers

      if (!Array.isArray(matricNumbers) || matricNumbers.length === 0) {
        return res.status(400).send({
          message: "Matric numbers array is required",
        });
      }

      // Verify the code exists
      const votingCode = await VotingCode.findOne({ code: codeValue, adminId });
      if (!votingCode) {
        return res.status(404).send({
          message: "Code not found or not owned by admin",
        });
      }

      if (!votingCode.isActive) {
        return res.status(400).send({
          message: "Cannot assign students to inactive code",
        });
      }

      // Process each matric number
      const results = {
        assigned: 0,
        updated: 0,
        notFound: [],
        errors: [],
      };

      for (const matric of matricNumbers) {
        try {
          const matricUpper = matric.trim().toUpperCase();

          // Find the student in whitelist
          const student = await Whitelist.findOne({
            matric: matricUpper,
            adminId,
          });

          if (!student) {
            results.notFound.push(matricUpper);
            continue;
          }

          // Check if student is already assigned to this code
          if (student.assignedCode === codeValue) {
            continue; // Skip - already assigned to this code
          }

          // Update the student's assigned code
          const wasUpdated =
            student.assignedCode && student.assignedCode !== codeValue;
          student.assignedCode = codeValue;
          student.assignedAt = new Date();
          await student.save();

          if (wasUpdated) {
            results.updated++;
          } else {
            results.assigned++;
          }
        } catch (error) {
          results.errors.push(`${matric}: ${error.message}`);
        }
      }

      // Update the code's student count
      const totalStudents = await Whitelist.countDocuments({
        assignedCode: codeValue,
        adminId,
      });

      res.send({
        message: "Bulk assignment completed",
        results,
        totalStudentsAssigned: totalStudents,
      });
    } catch (err) {
      res.status(500).send({
        message: "Error during bulk assignment",
        error: err.message,
      });
    }
  }
);

// Assign single student to a voting code
router.post(
  "/voting-codes/:code/assign-single",
  verifyToken,
  async (req, res) => {
    try {
      const adminId = req.user.id;
      const codeValue = req.params.code;
      const { matric } = req.body;

      if (!matric) {
        return res.status(400).send({ message: "Matric number is required" });
      }

      // Verify the code exists
      const votingCode = await VotingCode.findOne({ code: codeValue, adminId });
      if (!votingCode) {
        return res.status(404).send({
          message: "Code not found or not owned by admin",
        });
      }

      if (!votingCode.isActive) {
        return res.status(400).send({
          message: "Cannot assign student to inactive code",
        });
      }

      const matricUpper = matric.trim().toUpperCase();

      // Find the student in whitelist
      const student = await Whitelist.findOne({
        matric: matricUpper,
        adminId,
      });

      if (!student) {
        return res.status(404).send({
          message: "Student not found in whitelist",
        });
      }

      // Check if student is already assigned to this code
      if (student.assignedCode === codeValue) {
        return res.status(400).send({
          message: "Student is already assigned to this code",
        });
      }

      const previousCode = student.assignedCode;

      // Update the student's assigned code
      student.assignedCode = codeValue;
      student.assignedAt = new Date();
      await student.save();

      // Get updated student count for this code
      const studentCount = await Whitelist.countDocuments({
        assignedCode: codeValue,
        adminId,
      });

      const message = previousCode
        ? `Student reassigned from code ${previousCode} to ${codeValue}`
        : `Student assigned to code ${codeValue}`;

      res.send({
        message,
        student: {
          matric: student.matric,
          email: student.email,
          assignedCode: student.assignedCode,
          assignedAt: student.assignedAt,
        },
        codeStudentCount: studentCount,
      });
    } catch (err) {
      res.status(500).send({
        message: "Error assigning student",
        error: err.message,
      });
    }
  }
);

// Get students assigned to a specific code
router.get("/voting-codes/:code/students", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const codeValue = req.params.code;

    // Verify the code exists
    const votingCode = await VotingCode.findOne({ code: codeValue, adminId });
    if (!votingCode) {
      return res.status(404).send({
        message: "Code not found or not owned by admin",
      });
    }

    // Get all students assigned to this code
    const students = await Whitelist.find({
      assignedCode: codeValue,
      adminId,
    })
      .select("matric email voted assignedAt")
      .sort({ assignedAt: -1 });

    res.send({
      code: {
        code: votingCode.code,
        name: votingCode.name,
        description: votingCode.description,
        isActive: votingCode.isActive,
      },
      studentsCount: students.length,
      students: students.map((student) => ({
        matric: student.matric,
        email: student.email,
        voted: student.voted,
        assignedAt: student.assignedAt,
      })),
    });
  } catch (err) {
    res.status(500).send({
      message: "Error fetching students",
      error: err.message,
    });
  }
});

// Remove student from code (unassign)
router.delete(
  "/voting-codes/:code/students/:matric",
  verifyToken,
  async (req, res) => {
    try {
      const adminId = req.user.id;
      const codeValue = req.params.code;
      const matric = req.params.matric.toUpperCase();

      const student = await Whitelist.findOne({
        matric,
        assignedCode: codeValue,
        adminId,
      });

      if (!student) {
        return res.status(404).send({
          message: "Student not found or not assigned to this code",
        });
      }

      if (student.voted) {
        return res.status(400).send({
          message: "Cannot unassign student who has already voted",
        });
      }

      // For now, we'll keep the student in whitelist but remove code assignment
      // You might want to delete the student entirely - uncomment the line below
      // await Whitelist.deleteOne({ _id: student._id });

      // Or just clear the assigned code:
      student.assignedCode = "";
      await student.save();

      const remainingCount = await Whitelist.countDocuments({
        assignedCode: codeValue,
        adminId,
      });

      res.send({
        message: "Student unassigned from code",
        remainingStudents: remainingCount,
      });
    } catch (err) {
      res.status(500).send({
        message: "Error unassigning student",
        error: err.message,
      });
    }
  }
);

// Delete a voting code (only if no students are assigned or voted)
router.delete("/voting-codes/:code", verifyToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const codeValue = req.params.code;

    const votingCode = await VotingCode.findOne({ code: codeValue, adminId });
    if (!votingCode) {
      return res.status(404).send({
        message: "Code not found or not owned by admin",
      });
    }

    // Check if any students are assigned to this code
    const assignedStudents = await Whitelist.countDocuments({
      assignedCode: codeValue,
      adminId,
    });

    if (assignedStudents > 0) {
      return res.status(400).send({
        message: `Cannot delete code. ${assignedStudents} student(s) are still assigned to it.`,
      });
    }

    await VotingCode.deleteOne({ _id: votingCode._id });

    res.send({
      message: "Voting code deleted successfully",
      deletedCode: {
        code: votingCode.code,
        name: votingCode.name,
      },
    });
  } catch (err) {
    res.status(500).send({
      message: "Error deleting code",
      error: err.message,
    });
  }
});

module.exports = router;
