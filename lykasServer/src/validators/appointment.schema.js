const { z } = require("zod");

const appointmentCreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    date: z.string(),
    durationHours: z.number().positive().optional(),
    capacity: z.number().int().positive().optional(),
  })
  .strict();

const appointmentUpdateSchema = appointmentCreateSchema.partial();

const appointmentEnrollSchema = z
  .object({
    phone: z.string().min(1).max(30),
    emergencyContact: z.string().max(300).optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();

module.exports = { appointmentCreateSchema, appointmentUpdateSchema, appointmentEnrollSchema };
