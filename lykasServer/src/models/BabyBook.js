const mongoose = require("mongoose");

const babyBookSchema = new mongoose.Schema(
  {
    pet: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    title: { type: String, required: true },
    content: { type: String },
    category: { type: String, enum: ["Milestone", "Health", "Funny Moment", "Training", "First Time", "General"], default: "General" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BabyBook", babyBookSchema);
