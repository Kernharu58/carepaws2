const { z } = require("zod");

const createCheckoutSchema = z
  .object({
    type: z.enum(["donation", "adoption_fee", "event_fee"]),
    amount: z.number().int().positive(), // centavos
    description: z.string().min(1).max(300),
    refModel: z.enum(["Application", "Event"]).optional(),
    refId: z.string().optional(),
  })
  .strict();

const refundSchema = z.object({ reason: z.string().max(500).optional() }).strict();

module.exports = { createCheckoutSchema, refundSchema };
