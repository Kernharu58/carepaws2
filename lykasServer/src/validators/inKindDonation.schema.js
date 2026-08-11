const { z } = require("zod");

const inKindDonationCreateSchema = z
  .object({
    name: z.string().min(1).max(200),
    quantity: z.number().min(0).optional(),
    unit: z.string().max(50).optional(),
    items: z
      .array(z.object({ name: z.string(), quantity: z.number().optional(), unit: z.string().optional() }).strict())
      .optional(),
    dropOff: z.enum(["walk_in", "schedule", "courier"]),
    notes: z.string().max(1000).optional(),
  })
  .strict();

const inKindDonationStatusSchema = z
  .object({
    status: z.enum(["pending", "confirmed", "received", "cancelled"]),
    staffNote: z.string().max(1000).optional(),
  })
  .strict();

module.exports = { inKindDonationCreateSchema, inKindDonationStatusSchema };
