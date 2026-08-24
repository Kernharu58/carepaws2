const InventoryItem = require("../models/InventoryItem");

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

async function findInventoryItem(name) {
  const normalizedName = normalizeName(name);
  let item = await InventoryItem.findOne({ normalizedName });
  if (!item) {
    const escaped = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    item = await InventoryItem.findOne({ name: new RegExp(`^${escaped}$`, "i") });
    if (item && !item.normalizedName) {
      item.normalizedName = normalizedName;
      await item.save();
    }
  }
  return item;
}

function getDelta(type, quantity) {
  if (type === "usage") return -Math.abs(quantity);
  if (type === "adjustment") return quantity;
  return Math.abs(quantity);
}

async function applyManualMovement({ itemId, type, quantity, note, actor }) {
  const delta = getDelta(type, quantity);
  const filter = { _id: itemId };
  if (delta < 0) filter.quantity = { $gte: Math.abs(delta) };

  const update = {
    $inc: { quantity: delta },
    $push: { movements: { type, quantity: type === "adjustment" ? delta : Math.abs(quantity), note, actor, sourceType: "manual" } },
  };
  if (type === "restock" && delta > 0) {
    update.$set = { lastRestockedAt: new Date(), lastRestockedBy: actor };
  }

  return InventoryItem.findOneAndUpdate(filter, update, { new: true, runValidators: true });
}

async function applyDonationMovement({ item, quantity, donationId, actor, note }) {
  if (quantity <= 0) return { item, applied: false };

  const filter = {
    _id: item._id,
    movements: { $not: { $elemMatch: { sourceType: "inkind_donation", sourceId: donationId } } },
  };
  const updated = await InventoryItem.findOneAndUpdate(
    filter,
    {
      $inc: { quantity },
      $push: {
        movements: {
          type: "restock",
          quantity,
          note,
          actor,
          sourceType: "inkind_donation",
          sourceId: donationId,
        },
      },
      $set: { lastRestockedAt: new Date(), lastRestockedBy: actor },
    },
    { new: true, runValidators: true }
  );

  return { item: updated || item, applied: Boolean(updated) };
}

module.exports = { normalizeName, findInventoryItem, applyManualMovement, applyDonationMovement };
