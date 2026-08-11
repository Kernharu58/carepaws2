const { z } = require("zod");

const contentCreateSchema = z
  .object({
    type: z.enum(["faq", "policy", "page", "announcement"]),
    title: z.string().min(1).max(200),
    body: z.string().max(20000).optional(),
    category: z.string().max(100).optional(),
    order: z.number().int().optional(),
    isPublished: z.boolean().optional(),
    slug: z.string().max(200).optional(),
  })
  .strict();

const contentUpdateSchema = contentCreateSchema.partial();

module.exports = { contentCreateSchema, contentUpdateSchema };
