const { z } = require("zod");

const eventCreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    category: z.enum(["Adoption Drive", "Fundraiser", "Training", "Community", "Volunteer", "Other"]),
    date: z.string(),
    endDate: z.string().optional(),
    location: z.string().max(300).optional(),
    isOnline: z.boolean().optional(),
    onlineLink: z.string().url().optional(),
    maxAttendees: z.number().int().positive().optional(),
    notes: z.string().max(1000).optional(),
    status: z.enum(["upcoming", "ongoing", "completed", "cancelled"]).optional(),
  })
  .strict();

const eventUpdateSchema = eventCreateSchema.partial();

const eventAssignmentSchema = z
  .object({
    volunteer: z.string().min(1),
    role: z.string().max(200).optional(),
  })
  .strict();

module.exports = { eventCreateSchema, eventUpdateSchema, eventAssignmentSchema };
