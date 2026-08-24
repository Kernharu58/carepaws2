const mongoose = require("mongoose");
const Shelter = require("../../src/models/Shelter");
const Pet = require("../../src/models/Pet");
const {
  getShelterStats,
  getSheltersWithOccupancy,
  assertShelterAssignmentAllowed,
} = require("../../src/utils/shelterOccupancy");


describe("shelter occupancy", () => {
  async function createShelter(values = {}) {
    return Shelter.create({
      name: values.name || "Shelter",
      address: "Test address",
      type: values.type || "main_shelter",
      capacity: values.capacity ?? 2,
      status: values.status || "active",
      currentOccupancy: values.currentOccupancy ?? 999,
    });
  }

  async function createPet(shelterId = null, values = {}) {
    return Pet.create({ name: values.name || `Pet-${Date.now()}-${Math.random()}`, species: "Dog", shelterId });
  }

  it("derives an empty shelter at zero occupancy regardless of legacy persisted occupancy", async () => {
    const shelter = await createShelter({ capacity: 5, currentOccupancy: 4 });
    const stats = await getShelterStats(shelter._id);
    expect(stats.currentOccupancy).toBe(0);
    expect(stats.availableCapacity).toBe(5);
    expect(stats.occupancyPercentage).toBe(0);
  });

  it("counts one pet and reports capacity correctly", async () => {
    const shelter = await createShelter({ capacity: 2 });
    await createPet(shelter._id);
    const stats = await getShelterStats(shelter._id);
    expect(stats.currentOccupancy).toBe(1);
    expect(stats.availableCapacity).toBe(1);
    expect(stats.occupancyPercentage).toBe(50);
  });

  it("allows a pet up to capacity but rejects the next assignment", async () => {
    const shelter = await createShelter({ capacity: 1 });
    const pet = await createPet(shelter._id);
    const stats = await getShelterStats(shelter._id);
    expect(stats.currentOccupancy).toBe(1);
    await expect(assertShelterAssignmentAllowed(shelter._id, new mongoose.Types.ObjectId())).rejects.toMatchObject({
      message: "Shelter is at capacity",
      statusCode: 409,
    });
    expect(pet.shelterId.toString()).toBe(shelter._id.toString());
  });

  it("supports moving a pet between shelters without double counting", async () => {
    const shelterA = await createShelter({ name: "A", capacity: 2 });
    const shelterB = await createShelter({ name: "B", capacity: 2 });
    const pet = await createPet(shelterA._id);

    await assertShelterAssignmentAllowed(shelterB._id, pet._id);
    pet.shelterId = shelterB._id;
    await pet.save();

    const shelters = await getSheltersWithOccupancy();
    const a = shelters.find((s) => s._id.toString() === shelterA._id.toString());
    const b = shelters.find((s) => s._id.toString() === shelterB._id.toString());
    expect(a.currentOccupancy).toBe(0);
    expect(b.currentOccupancy).toBe(1);
  });

  it("removing a pet releases capacity", async () => {
    const shelter = await createShelter({ capacity: 1 });
    const pet = await createPet(shelter._id);
    pet.shelterId = null;
    await pet.save();
    const stats = await getShelterStats(shelter._id);
    expect(stats.currentOccupancy).toBe(0);
    expect(stats.availableCapacity).toBe(1);
  });

  it("does not count archived pets and rejects inactive shelters", async () => {
    const inactive = await createShelter({ status: "inactive", capacity: 2 });
    const pet = await createPet(null);
    await expect(assertShelterAssignmentAllowed(inactive._id)).rejects.toMatchObject({ statusCode: 409 });
    pet.shelterId = inactive._id;
    pet.isDeleted = true;
    await pet.save();
    const stats = await getShelterStats(inactive._id);
    expect(stats.currentOccupancy).toBe(0);
  });
});
