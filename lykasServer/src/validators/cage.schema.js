const { z } = require("zod");

const cageCreateSchema = z.object({
  shelterId: z.string().min(1),
  cageNumber: z.string().min(1).max(50),
  section: z.string().max(100).optional(),
  capacity: z.number().int().min(1).max(100),
  status: z.enum(["active", "maintenance", "inactive"]).optional(),
  quarantineOnly: z.boolean().optional(),
  allowedSpecies: z.array(z.enum(["Dog", "Cat", "Other"])).min(1).optional(),
  notes: z.string().max(500).optional(),
}).strict();

const cageUpdateSchema = cageCreateSchema.partial().omit({ shelterId: true });

module.exports = { cageCreateSchema, cageUpdateSchema };
