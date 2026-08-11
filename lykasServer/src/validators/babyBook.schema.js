const { z } = require("zod");

const babyBookCreateSchema = z
  .object({
    pet: z.string().min(1),
    title: z.string().min(1).max(200),
    content: z.string().max(2000).optional(),
    category: z.enum(["Milestone", "Health", "Funny Moment", "Training", "First Time", "General"]).optional(),
    date: z.string().optional(),
  })
  .strict();

const babyBookUpdateSchema = babyBookCreateSchema.partial();

module.exports = { babyBookCreateSchema, babyBookUpdateSchema };
