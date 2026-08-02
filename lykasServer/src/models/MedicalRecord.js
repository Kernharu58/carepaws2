const mongoose = require("mongoose");

// Three related sub-types sharing a `pet` ref (§5.2).

const vaccinationSchema = new mongoose.Schema(
  {
    pet: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    vaccineName: { type: String, required: true },
    dateGiven: { type: Date, required: true },
    nextDueDate: { type: Date },
    administeredBy: { type: String },
    batchNumber: { type: String },
    notes: { type: String },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const vetVisitSchema = new mongoose.Schema(
  {
    pet: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    visitDate: { type: Date, required: true },
    reason: { type: String },
    vetName: { type: String },
    clinic: { type: String },
    diagnosis: { type: String },
    treatment: { type: String },
    prescription: { type: String },
    followUpDate: { type: Date },
    cost: { type: Number },
    notes: { type: String },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const generalRecordSchema = new mongoose.Schema(
  {
    pet: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    type: { type: String, enum: ["Surgery", "Deworming", "Flea Treatment", "Dental", "Spay/Neuter", "Injury", "Illness", "Other"], required: true },
    date: { type: Date, required: true },
    description: { type: String },
    performedBy: { type: String },
    outcome: { type: String },
    followUpRequired: { type: Boolean, default: false },
    followUpDate: { type: Date },
    cost: { type: Number },
    notes: { type: String },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = {
  Vaccination: mongoose.model("Vaccination", vaccinationSchema),
  VetVisit: mongoose.model("VetVisit", vetVisitSchema),
  GeneralMedicalRecord: mongoose.model("GeneralMedicalRecord", generalRecordSchema),
};
