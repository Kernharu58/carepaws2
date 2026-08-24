const Cage = require("../models/Cage");
const Pet = require("../models/Pet");
const { CageAssignment, QuarantinePeriod } = require("../models/ShelterCare");
const Shelter = require("../models/Shelter");

function cageError(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function getCageOccupancy(cageId) {
  return CageAssignment.countDocuments({ cageId, isActive: true });
}

async function getCagesWithOccupancy(filter = {}) {
  const cages = await Cage.find(filter).populate("shelterId", "name status").sort({ shelterId: 1, cageNumber: 1 }).lean();
  if (!cages.length) return [];

  const rows = await CageAssignment.aggregate([
    { $match: { isActive: true, cageId: { $ne: null } } },
    { $group: { _id: "$cageId", count: { $sum: 1 } } },
  ]);
  const occupancy = new Map(rows.map((row) => [String(row._id), row.count]));

  return cages.map((cage) => {
    const currentOccupancy = occupancy.get(String(cage._id)) || 0;
    return {
      ...cage,
      currentOccupancy,
      availableCapacity: Math.max(0, cage.capacity - currentOccupancy),
      isEmpty: currentOccupancy === 0,
      availability: cage.status === "active" && currentOccupancy < cage.capacity ? "available" : "unavailable",
    };
  });
}

async function assertCageAssignmentAllowed(cageId, petId) {
  const [cage, pet] = await Promise.all([
    Cage.findById(cageId),
    Pet.findOne({ _id: petId, isDeleted: { $ne: true } }),
  ]);

  if (!cage) throw cageError("Cage not found", 404);
  if (!pet) throw cageError("Pet not found", 404);
  if (!pet.shelterId) throw cageError("Pet must be assigned to a shelter before cage assignment");
  if (String(pet.shelterId) !== String(cage.shelterId)) {
    throw cageError("Pet and cage must belong to the same shelter");
  }
  if (cage.status !== "active") throw cageError("Cannot assign a pet to an inactive or unavailable cage");

  const existingAssignment = await CageAssignment.findOne({ pet: pet._id, isActive: true });
  if (existingAssignment) throw cageError("Pet already has an active cage assignment");

  const quarantine = await QuarantinePeriod.findOne({ pet: pet._id, isActive: true });
  if (Boolean(quarantine) !== Boolean(cage.quarantineOnly)) {
    if (quarantine) throw cageError("Quarantined pets can only be assigned to quarantine cages");
    throw cageError("Normal pets cannot be assigned to quarantine-only cages");
  }

  if (!cage.allowedSpecies.includes(pet.species)) {
    throw cageError(`Cage ${cage.cageNumber} does not accept ${pet.species} pets`);
  }

  const occupancy = await getCageOccupancy(cage._id);
  if (occupancy >= cage.capacity) throw cageError("Cage is at capacity");

  if (occupancy > 0) {
    const occupants = await CageAssignment.find({ cageId: cage._id, isActive: true }).populate("pet", "species");
    if (occupants.some((assignment) => assignment.pet && assignment.pet.species !== pet.species)) {
      throw cageError("Cage cannot contain incompatible pet species");
    }
  }

  const shelter = await Shelter.findById(cage.shelterId).select("status");
  if (!shelter || shelter.status === "inactive" || shelter.status === "under_maintenance") {
    throw cageError("Pets cannot be assigned in an inactive or unavailable shelter");
  }

  return { cage, pet };
}

module.exports = { cageError, getCagesWithOccupancy, getCageOccupancy, assertCageAssignmentAllowed };
