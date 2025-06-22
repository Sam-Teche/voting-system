const express = require("express");
const { verifyToken } = require("../middleware/auth");
const {
  Admin,
  Candidate,
  Vote,
  Whitelist,
  VotingCode,
  Link,
} = require("../models");

const router = express.Router();

/**
 * DELETE /api/admin/delete
 * Deletes the logged-in admin and all their associated data
 */
router.delete("/delete", verifyToken, async (req, res) => {
  const adminId = req.user.id;

  try {
    // Step 1: Delete all related records
    const [candidates, votes, whitelist, codes, links] = await Promise.all([
      Candidate.deleteMany({ adminId }),
      Vote.deleteMany({ adminId }),
      Whitelist.deleteMany({ adminId }),
      VotingCode.deleteMany({ adminId }),
      Link.deleteMany({ adminId }),
    ]);

    // Step 2: Delete the admin
    const deletedAdmin = await Admin.findByIdAndDelete(adminId);

    if (!deletedAdmin) {
      return res.status(404).send({ message: "Admin not found" });
    }

    res.send({
      message: "Admin and all related data deleted successfully",
      summary: {
        adminId,
        candidatesDeleted: candidates.deletedCount,
        votesDeleted: votes.deletedCount,
        whitelistDeleted: whitelist.deletedCount,
        votingCodesDeleted: codes.deletedCount,
        linksDeleted: links.deletedCount,
      },
    });
  } catch (err) {
    console.error("Error deleting admin and data:", err);
    res
      .status(500)
      .send({ message: "Error during deletion", error: err.message });
  }
});

module.exports = router;
