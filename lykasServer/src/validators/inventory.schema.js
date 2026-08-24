const { z } = require("zod");

const inventoryFields = {
  name: z.string().min(1).max(200),
  category: z.enum(["food", "medical", "bedding", "cleaning", "equipment", "office", "other"]),
  unit: z.string().max(50).optional(),
  minThreshold: z.number().min(0).optional(),
  location: z.string().max(200).optional(),
  supplier: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
};

const inventoryItemSchema = z.object({
  ...inventoryFields,
  quantity: z.number().min(0).optional(),
}).strict();

// Quantity is transaction-derived and cannot be edited through the item update endpoint.
const inventoryUpdateSchema = z.object(inventoryFields).partial().strict();

const inventoryAdjustSchema = z
  .object({
    type: z.enum(["restock", "usage", "adjustment"]),
    quantity: z.number().finite(),
    note: z.string().max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (["restock", "usage"].includes(value.type) && value.quantity <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quantity"], message: "Quantity must be greater than zero" });
    }
    if (value.type === "adjustment" && value.quantity === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quantity"], message: "Adjustment cannot be zero" });
    }
  });

module.exports = { inventoryItemSchema, inventoryUpdateSchema, inventoryAdjustSchema };
