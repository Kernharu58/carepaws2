const express = require("express");
const router = express.Router();
const BabyBook = require("../models/BabyBook");
const Pet = require("../models/Pet");
const { protect } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { babyBookCreateSchema, babyBookUpdateSchema } = require("../validators/babyBook.schema");

const STAFF_ROLES = ["staff", "admin", "super_admin"];

function isStaff(user) {
  return STAFF_ROLES.includes(user.role);
}

function ownsPet(pet, user) {
  return Boolean(pet && pet.owner && pet.owner.equals(user._id));
}

// Staff can view any pet's baby book (shelter/foster oversight); everyone
// else only their own pet's, matching the ownership model used by /my below.
async function canAccessPet(user, petId) {
  const pet = await Pet.findById(petId).select("owner");
  if (!pet) return false;
  return isStaff(user) || ownsPet(pet, user);
}

router.get("/my", protect, async (req, res, next) => {
  try {
    const myPets = await Pet.find({ owner: req.user._id }).select("_id");
    const entries = await BabyBook.find({ pet: { $in: myPets.map((p) => p._id) } }).sort({ date: -1 });
    res.json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
});

router.get("/entry/:id", protect, async (req, res, next) => {
  try {
    const entry = await BabyBook.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: "Entry not found" });
    if (!(await canAccessPet(req.user, entry.pet))) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }
    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, validateRequest(babyBookCreateSchema), async (req, res, next) => {
  try {
    const pet = await Pet.findById(req.body.pet).select("owner");
    if (!pet) return res.status(404).json({ success: false, message: "Pet not found" });
    if (!isStaff(req.user) && !ownsPet(pet, req.user)) {
      return res.status(403).json({ success: false, message: "You can only add baby book entries for your own pets" });
    }
    const entry = await BabyBook.create({ ...req.body, addedBy: req.user._id });
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
});

router.put("/entry/:id", protect, validateRequest(babyBookUpdateSchema), async (req, res, next) => {
  try {
    const entry = await BabyBook.findOneAndUpdate(
      { _id: req.params.id, addedBy: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ success: false, message: "Entry not found" });
    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
});

router.delete("/entry/:id", protect, async (req, res, next) => {
  try {
    const entry = await BabyBook.findOneAndDelete({ _id: req.params.id, addedBy: req.user._id });
    if (!entry) return res.status(404).json({ success: false, message: "Entry not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get("/:petId", protect, async (req, res, next) => {
  try {
    if (!(await canAccessPet(req.user, req.params.petId))) {
      return res.status(404).json({ success: false, message: "Pet not found" });
    }
    const entries = await BabyBook.find({ pet: req.params.petId }).sort({ date: -1 });
    res.json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
