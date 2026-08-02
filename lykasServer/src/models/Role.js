const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true },
    description: { type: String, default: "" },
    // "*" grants all permissions — preserved from the source convention
    permissions: [{ type: String }],
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Role", roleSchema);
