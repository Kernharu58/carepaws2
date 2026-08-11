const { z } = require("zod");

const inventoryItemSchema = z
  .object({
    name: z.string().min(1).max(200),
    category: z.enum(["food", "medical", "bedding", "cleaning", "equipment", "office", "other"]),
    quantity: z.number().min(0).optional(),
    unit: z.string().max(50).optional(),
    minThreshold: z.number().min(0).optional(),
    location: z.string().max(200).optional(),
    supplier: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();

const inventoryUpdateSchema = inventoryItemSchema.partial();

const inventoryAdjustSchema = z
  .object({
    type: z.enum(["restock", "usage", "adjustment"]),
    quantity: z.number(),
    note: z.string().max(500).optional(),
  })
  .strict();

module.exports = { inventoryItemSchema, inventoryUpdateSchema, inventoryAdjustSchema };
