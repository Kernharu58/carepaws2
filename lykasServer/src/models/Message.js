const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sender: { type: String, enum: ["user", "admin", "shelter"], required: true },
    text: { type: String },
    image: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
