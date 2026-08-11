const { z } = require("zod");

const announcementCreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    message: z.string().min(1).max(2000),
    level: z.enum(["info", "warning", "critical"]).optional(),
    audience: z.enum(["all", "admin", "user"]).optional(),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const announcementUpdateSchema = announcementCreateSchema.partial();

module.exports = { announcementCreateSchema, announcementUpdateSchema };
