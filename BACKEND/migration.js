const mongoose = require("mongoose");
const { Vote, Candidate } = require("./models"); // Adjust if needed

const DB_URI = "mongodb+srv://ogunrindesam:Gx7qsw6f1hY8Mcgx@cluster0.crattvq.mongodb.net/NEW_VOTING_SYSTEM?retryWrites=true&w=majority&appName=Cluster0"; // replace this

async function migrateVotes() {
  try {
    await mongoose.connect(DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to DB. Starting vote migration...");

    const existingVotes = await Vote.find({});
    console.log(`Found ${existingVotes.length} existing votes`);

    for (const vote of existingVotes) {
      const candidate = await Candidate.findById(vote.candidateId);

      if (candidate) {
        await Vote.findByIdAndUpdate(vote._id, {
          position: candidate.post,
          timestamp: vote.timestamp || new Date(),
          adminId: candidate.adminId, // if needed
        });

        console.log(
          `Updated vote for matric ${vote.matric} - position: ${candidate.post}`
        );
      } else {
        console.warn(`⚠️ Candidate not found for vote ID ${vote._id}`);
      }
    }

    await Vote.collection.createIndex(
      { matric: 1, position: 1 },
      { unique: true }
    );

    console.log("✅ Migration and index creation completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateVotes();
