const Pet = require("../models/Pet");
const Shelter = require("../models/Shelter");

async function getOccupancyByShelter() {
  const rows = await Pet.aggregate([
    { $match: { shelterId: { $ne: null }, isDeleted: { $ne: true } } },
    { $group: { _id: "$shelterId", count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [String(row._id), row.count]));
}

function addDerivedStats(shelter, occupancy) {
  const capacity = Math.max(0, Number(shelter.capacity) || 0);
  const currentOccupancy = Math.max(0, Number(occupancy) || 0);
  const availableCapacity = Math.max(0, capacity - currentOccupancy);
  const occupancyPercentage = capacity > 0 ? Math.round((currentOccupancy / capacity) * 10000) / 100 : 0;

  return {
    ...shelter,
    capacity,
    currentOccupancy,
    availableCapacity,
    occupancyPercentage,
  };
}

async function getSheltersWithOccupancy(filter = {}) {
  const [shelters, occupancyByShelter] = await Promise.all([
    Shelter.find(filter).sort({ name: 1 }).lean(),
    getOccupancyByShelter(),
  ]);

  return shelters.map((shelter) => addDerivedStats(shelter, occupancyByShelter.get(String(shelter._id)) || 0));
}

async function getShelterWithOccupancy(id) {
  const [shelter, occupancyByShelter] = await Promise.all([
    Shelter.findById(id).lean(),
    getOccupancyByShelter(),
  ]);
  if (!shelter) return null;
  return addDerivedStats(shelter, occupancyByShelter.get(String(shelter._id)) || 0);
}

async function getShelterStats(id) {
  const shelter = await Shelter.findById(id).lean();
  if (!shelter) return null;
  const occupancy = await Pet.countDocuments({ shelterId: id, isDeleted: { $ne: true } });
  return addDerivedStats(shelter, occupancy);
}

async function assertShelterAssignmentAllowed(shelterId, petIdToIgnore = null) {
  if (!shelterId) return null;
  const shelter = await Shelter.findById(shelterId);
  if (!shelter) {
    const error = new Error("Shelter not found");
    error.statusCode = 404;
    throw error;
  }
  if (shelter.status === "inactive" || shelter.status === "under_maintenance") {
    const error = new Error("Pets cannot be assigned to an inactive or unavailable shelter");
    error.statusCode = 409;
    throw error;
  }

  const filter = { shelterId, isDeleted: { $ne: true } };
  if (petIdToIgnore) filter._id = { $ne: petIdToIgnore };
  const occupancy = await Pet.countDocuments(filter);
  const capacity = Math.max(0, Number(shelter.capacity) || 0);
  if (occupancy >= capacity) {
    const error = new Error("Shelter is at capacity");
    error.statusCode = 409;
    throw error;
  }

  return shelter;
}

module.exports = {
  addDerivedStats,
  getOccupancyByShelter,
  getSheltersWithOccupancy,
  getShelterWithOccupancy,
  getShelterStats,
  assertShelterAssignmentAllowed,
};
