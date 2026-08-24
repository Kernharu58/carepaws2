const cloudinary = require("../config/cloudinary");
const Pet = require("../models/Pet");
const { buildListQuery, buildSort, buildPagination } = require("../utils/queryBuilder");
const { writeAuditLog } = require("../utils/auditLogger");
const { assertShelterAssignmentAllowed } = require("../utils/shelterOccupancy");

const SEARCH_FIELDS = ["name", "breed", "description"];
const FILTER_FIELDS = ["status", "species", "gender", "size", "temperament", "energyLevel"];

function uploadBufferToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

// GET /api/pets — public list
async function listPets(req, res, next) {
  try {
    const filter = buildListQuery(req.query, { searchFields: SEARCH_FIELDS, filterFields: FILTER_FIELDS, allowIncludeDeleted: false });
    filter.status = filter.status || "Available"; // public catalog defaults to Available unless a status filter was given
    if (req.query.status) filter.status = req.query.status;

    const sort = buildSort(req.query);
    const { page, limit, skip, ...paginationRest } = buildPagination(
      await Pet.countDocuments(filter),
      req.query.page,
      req.query.limit
    );

    const data = await Pet.find(filter).sort(sort).skip(skip).limit(limit);

    return res.json({ success: true, data, pagination: { page, limit, ...paginationRest } });
  } catch (err) {
    next(err);
  }
}

// GET /api/pets/admin — full filtered/paginated list incl. adopted/foster/deleted
async function listPetsAdmin(req, res, next) {
  try {
    const filter = buildListQuery(req.query, { searchFields: SEARCH_FIELDS, filterFields: FILTER_FIELDS, allowIncludeDeleted: true });
    const sort = buildSort(req.query);
    const total = await Pet.countDocuments(filter);
    const { page, limit, skip, ...paginationRest } = buildPagination(total, req.query.page, req.query.limit);

    const data = await Pet.find(filter).sort(sort).skip(skip).limit(limit);

    return res.json({ success: true, data, pagination: { page, limit, ...paginationRest } });
  } catch (err) {
    next(err);
  }
}

// GET /api/pets/:id
async function getPet(req, res, next) {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!pet) return res.status(404).json({ success: false, message: "Pet not found" });
    return res.json({ success: true, data: pet });
  } catch (err) {
    next(err);
  }
}

// POST /api/pets — admin, multipart image upload
async function createPet(req, res, next) {
  try {
    let imageUrl = null;
    if (req.body.shelterId) await assertShelterAssignmentAllowed(req.body.shelterId);

    if (req.file) {
      const result = await uploadBufferToCloudinary(req.file.buffer, "carepaws/pets");
      imageUrl = result.secure_url;
    }

    const pet = await Pet.create({ ...req.body, imageUrl });

    await writeAuditLog({
      actor: req.user._id,
      action: "pet.create",
      entityType: "Pet",
      entityId: pet._id,
      newValues: pet.toObject(),
      req,
    });

    return res.status(201).json({ success: true, data: pet });
  } catch (err) {
    next(err);
  }
}

// PUT /api/pets/:id
async function updatePet(req, res, next) {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!pet) return res.status(404).json({ success: false, message: "Pet not found" });

    const previousValues = pet.toObject();

    // Owner and status are meant to stay in sync: Adopted/Foster pets
    // should have an owner, Available/Pending pets should not. The normal
    // path for changing this is the applications workflow (which keeps
    // both in lockstep — see applicationController), but this direct
    // admin edit can also change status, so guard against leaving the
    // pair in an inconsistent/impossible state.
    if (req.body.status && req.body.status !== pet.status) {
      const nextStatus = req.body.status;
      if ((nextStatus === "Adopted" || nextStatus === "Foster") && !pet.owner) {
        return res.status(409).json({
          success: false,
          message: `Cannot mark this pet as ${nextStatus} without an assigned owner. Use the adoption/foster application workflow to assign one.`,
        });
      }
      if (nextStatus === "Available" || nextStatus === "Pending") {
        pet.owner = null;
      }
    }

    const nextShelterId = Object.prototype.hasOwnProperty.call(req.body, "shelterId") ? req.body.shelterId : pet.shelterId;
    if (nextShelterId && String(nextShelterId) !== String(pet.shelterId || "")) {
      await assertShelterAssignmentAllowed(nextShelterId, pet._id);
    }

    if (req.file) {
      const result = await uploadBufferToCloudinary(req.file.buffer, "carepaws/pets");
      pet.imageUrl = result.secure_url;
    }

    Object.assign(pet, req.body);
    await pet.save();

    await writeAuditLog({
      actor: req.user._id,
      action: "pet.update",
      entityType: "Pet",
      entityId: pet._id,
      previousValues,
      newValues: pet.toObject(),
      req,
    });

    return res.json({ success: true, data: pet });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/pets/:id — soft delete
async function deletePet(req, res, next) {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!pet) return res.status(404).json({ success: false, message: "Pet not found" });

    pet.isDeleted = true;
    pet.deletedAt = new Date();
    pet.deletedBy = req.user._id;
    await pet.save();

    await writeAuditLog({ actor: req.user._id, action: "pet.delete", entityType: "Pet", entityId: pet._id, req });

    return res.json({ success: true, message: "Pet archived" });
  } catch (err) {
    next(err);
  }
}

// POST /api/pets/:id/restore
async function restorePet(req, res, next) {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, isDeleted: true });
    if (!pet) return res.status(404).json({ success: false, message: "Deleted pet not found" });

    pet.isDeleted = false;
    pet.deletedAt = null;
    pet.deletedBy = null;
    await pet.save();

    await writeAuditLog({ actor: req.user._id, action: "pet.restore", entityType: "Pet", entityId: pet._id, req });

    return res.json({ success: true, data: pet });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/pets/:id/permanent — super_admin only
async function permanentlyDeletePet(req, res, next) {
  try {
    const pet = await Pet.findByIdAndDelete(req.params.id);
    if (!pet) return res.status(404).json({ success: false, message: "Pet not found" });

    await writeAuditLog({ actor: req.user._id, action: "pet.permanent_delete", entityType: "Pet", entityId: pet._id, req });

    return res.json({ success: true, message: "Pet permanently deleted" });
  } catch (err) {
    next(err);
  }
}

// GET /api/pets/my-pets — pets the current user owns
async function myPets(req, res, next) {
  try {
    const pets = await Pet.find({ owner: req.user._id, isDeleted: { $ne: true } });
    return res.json({ success: true, data: pets });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPets,
  listPetsAdmin,
  getPet,
  createPet,
  updatePet,
  deletePet,
  restorePet,
  permanentlyDeletePet,
  myPets,
};
