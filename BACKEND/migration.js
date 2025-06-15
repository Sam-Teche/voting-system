// migration.js - Run this once to update existing data
const mongoose = require("mongoose");
const { Vote, Candidate } = require("./models"); // Adjust path as needed

async function migrateVotes() {
  try {
    console.log("Starting vote migration...");

    // Get all existing votes
    const existingVotes = await Vote.find({});
    console.log(`Found ${existingVotes.length} existing votes`);

    for (const vote of existingVotes) {
      // Find the candidate to get the position
      const candidate = await Candidate.findById(vote.candidateId);

      if (candidate) {
        // Update the vote with position information
        await Vote.findByIdAndUpdate(vote._id, {
          position: candidate.post,
          timestamp: vote.timestamp || new Date(),
          // Add adminId if you have this information
        });

        console.log(
          `Updated vote for matric ${vote.matric} - position: ${candidate.post}`
        );
      } else {
        console.log(`Warning: Candidate not found for vote ${vote._id}`);
      }
    }

    console.log("Migration completed successfully!");

    // Create the compound index
    await Vote.collection.createIndex(
      { matric: 1, position: 1 },
      { unique: true }
    );
    console.log("Compound index created successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

// Run migration
migrateVotes();
