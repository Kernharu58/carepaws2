const { Vaccination, VetVisit, GeneralMedicalRecord } = require("../models/MedicalRecord");

// GET /api/medical/summary/:petId
async function summary(req, res, next) {
  try {
    const [vaccinations, vetVisits, records] = await Promise.all([
      Vaccination.find({ pet: req.params.petId }).sort({ dateGiven: -1 }),
      VetVisit.find({ pet: req.params.petId }).sort({ visitDate: -1 }),
      GeneralMedicalRecord.find({ pet: req.params.petId }).sort({ date: -1 }),
    ]);
    return res.json({ success: true, data: { vaccinations, vetVisits, records } });
  } catch (err) {
    next(err);
  }
}

// --- Vaccinations ---
async function createVaccination(req, res, next) {
  try {
    const doc = await Vaccination.create({ ...req.body, recordedBy: req.user._id });
    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

// GET /api/medical/vaccinations/upcoming — used by the reminder cron job
async function upcomingVaccinations(req, res, next) {
  try {
    const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const docs = await Vaccination.find({ nextDueDate: { $lte: inTwoWeeks, $gte: new Date() } }).populate("pet");
    return res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
}

async function listVaccinations(req, res, next) {
  try {
    const docs = await Vaccination.find({ pet: req.params.petId }).sort({ dateGiven: -1 });
    return res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
}

async function updateVaccination(req, res, next) {
  try {
    const doc = await Vaccination.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: "Vaccination record not found" });
    return res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

async function deleteVaccination(req, res, next) {
  try {
    const doc = await Vaccination.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Vaccination record not found" });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// --- Vet visits ---
async function createVetVisit(req, res, next) {
  try {
    const doc = await VetVisit.create({ ...req.body, recordedBy: req.user._id });
    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

async function listVetVisits(req, res, next) {
  try {
    const docs = await VetVisit.find({ pet: req.params.petId }).sort({ visitDate: -1 });
    return res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
}

async function updateVetVisit(req, res, next) {
  try {
    const doc = await VetVisit.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: "Vet visit not found" });
    return res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

async function deleteVetVisit(req, res, next) {
  try {
    const doc = await VetVisit.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Vet visit not found" });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// --- General records ---
async function createRecord(req, res, next) {
  try {
    const doc = await GeneralMedicalRecord.create({ ...req.body, recordedBy: req.user._id });
    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

async function listRecords(req, res, next) {
  try {
    const docs = await GeneralMedicalRecord.find({ pet: req.params.petId }).sort({ date: -1 });
    return res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
}

async function updateRecord(req, res, next) {
  try {
    const doc = await GeneralMedicalRecord.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: "Medical record not found" });
    return res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

async function deleteRecord(req, res, next) {
  try {
    const doc = await GeneralMedicalRecord.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Medical record not found" });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  summary,
  createVaccination,
  upcomingVaccinations,
  listVaccinations,
  updateVaccination,
  deleteVaccination,
  createVetVisit,
  listVetVisits,
  updateVetVisit,
  deleteVetVisit,
  createRecord,
  listRecords,
  updateRecord,
  deleteRecord,
};
