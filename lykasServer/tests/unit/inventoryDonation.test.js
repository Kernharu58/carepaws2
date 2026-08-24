const mongoose = require("mongoose");
const InventoryItem = require("../../src/models/InventoryItem");
const InKindDonation = require("../../src/models/InKindDonation");
const { applyManualMovement } = require("../../src/utils/inventoryService");
const { updateStatus } = require("../../src/controllers/inKindDonationController");

describe("inventory transactions and in-kind donations", () => {
  const actor = new mongoose.Types.ObjectId();

  function response() {
    return {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
  }

  it("records initial stock as a restock movement", async () => {
    const item = await InventoryItem.create({ name: "Dog Food", category: "food", quantity: 10, unit: "kg" });
    expect(item.quantity).toBe(10);
    expect(item.movements).toHaveLength(1);
    expect(item.movements[0]).toMatchObject({ type: "restock", quantity: 10, sourceType: "manual" });
  });

  it("prevents usage from taking stock below zero", async () => {
    const item = await InventoryItem.create({ name: "Gloves", category: "medical", quantity: 2 });
    const updated = await applyManualMovement({ itemId: item._id, type: "usage", quantity: 3, actor });
    expect(updated).toBeNull();

    const unchanged = await InventoryItem.findById(item._id);
    expect(unchanged.quantity).toBe(2);
    expect(unchanged.movements).toHaveLength(0);
  });

  it("supports zero stock and usage after a restock", async () => {
    const item = await InventoryItem.create({ name: "Bedding", category: "bedding", quantity: 0 });
    const restocked = await applyManualMovement({ itemId: item._id, type: "restock", quantity: 5, actor });
    expect(restocked.quantity).toBe(5);
    const used = await applyManualMovement({ itemId: item._id, type: "usage", quantity: 5, actor });
    expect(used.quantity).toBe(0);
    expect(used.movements).toHaveLength(2);
  });

  it("records adjustments and allows negative adjustments only when enough stock exists", async () => {
    const item = await InventoryItem.create({ name: "Cleaner", category: "cleaning", quantity: 5 });
    const added = await applyManualMovement({ itemId: item._id, type: "adjustment", quantity: 3, actor });
    expect(added.quantity).toBe(8);
    const reduced = await applyManualMovement({ itemId: item._id, type: "adjustment", quantity: -8, actor });
    expect(reduced.quantity).toBe(0);
    const rejected = await applyManualMovement({ itemId: item._id, type: "adjustment", quantity: -1, actor });
    expect(rejected).toBeNull();
  });

  it("adds inventory only when an in-kind donation is received", async () => {
    const item = await InventoryItem.create({ name: "Cat Food", category: "food", quantity: 4, unit: "kg" });
    const donation = await InKindDonation.create({ name: "Cat Food", quantity: 6, unit: "kg", dropOff: "walk_in", status: "pending" });

    const confirmedResponse = response();
    await updateStatus(
      { params: { id: donation._id }, body: { status: "confirmed" }, user: { _id: actor } },
      confirmedResponse,
      (err) => { throw err; }
    );
    expect(confirmedResponse.statusCode).toBe(200);
    expect((await InventoryItem.findById(item._id)).quantity).toBe(4);

    const receivedResponse = response();
    await updateStatus(
      { params: { id: donation._id }, body: { status: "received" }, user: { _id: actor } },
      receivedResponse,
      (err) => { throw err; }
    );
    expect(receivedResponse.statusCode).toBe(200);
    const updated = await InventoryItem.findById(item._id);
    expect(updated.quantity).toBe(10);
    expect(updated.movements.filter((m) => String(m.sourceId) === String(donation._id))).toHaveLength(1);
  });

  it("does not duplicate inventory when the same received donation is processed twice", async () => {
    const item = await InventoryItem.create({ name: "Rice", category: "food", quantity: 0, unit: "kg" });
    const donation = await InKindDonation.create({ name: "Rice", quantity: 10, unit: "kg", dropOff: "courier", status: "pending" });

    for (let i = 0; i < 2; i += 1) {
      const res = response();
      await updateStatus(
        { params: { id: donation._id }, body: { status: "received" }, user: { _id: actor } },
        res,
        (err) => { throw err; }
      );
      expect(res.statusCode).toBe(200);
    }

    const updated = await InventoryItem.findById(item._id);
    expect(updated.quantity).toBe(10);
    expect(updated.movements.filter((m) => String(m.sourceId) === String(donation._id))).toHaveLength(1);
  });

  it("does not add inventory for a cancelled donation", async () => {
    const donation = await InKindDonation.create({ name: "Blankets", quantity: 5, unit: "pcs", dropOff: "schedule", status: "pending" });
    const res = response();
    await updateStatus(
      { params: { id: donation._id }, body: { status: "cancelled" }, user: { _id: actor } },
      res,
      (err) => { throw err; }
    );
    expect(res.statusCode).toBe(200);
    expect(await InventoryItem.findOne({ normalizedName: "blankets" })).toBeNull();
  });
});
