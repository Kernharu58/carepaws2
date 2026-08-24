const mongoose = require("mongoose");

const petSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    species: { type: String, enum: ["Dog", "Cat", "Other"], required: true },
    breed: { type: String, default: "" },
    age: { type: Number },
    gender: { type: String, enum: ["Male", "Female"] },
    size: { type: String, enum: ["Small", "Medium", "Large"] },
    weight: { type: Number },
    temperament: {
      type: String,
      enum: ["Calm", "Playful", "Shy", "Energetic", "Affectionate", "Independent"],
    },
    energyLevel: { type: String, enum: ["Low", "Medium", "High"] },
    healthStatus: { type: String, default: "" },
    description: { type: String, default: "" },
    imageUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ["Available", "Pending", "Adopted", "Foster"],
      default: "Available",
      index: true,
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    shelterId: { type: mongoose.Schema.Types.ObjectId, ref: "Shelter", default: null, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

petSchema.index({ status: 1, species: 1 });
petSchema.index({ name: "text", breed: "text", description: "text" });

module.exports = mongoose.model("Pet", petSchema);
