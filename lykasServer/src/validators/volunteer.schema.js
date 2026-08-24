const { z } = require("zod");

const volunteerRegisterSchema = z
  .object({
    phone: z.string().min(1),
    address: z.string().min(1),
    motivation: z.string().optional(),
    availability: z.array(z.enum(["Weekday mornings", "Weekday afternoons", "Weekends", "Flexible"])).optional(),
    skills: z.array(z.string()).optional(),
    emergencyContact: z
      .object({ name: z.string(), phone: z.string(), relationship: z.string() })
      .partial()
      .optional(),
  })
  .strict();

const volunteerStatusSchema = z
  .object({ status: z.enum(["pending", "approved", "rejected", "inactive"]), notes: z.string().max(1000).optional() })
  .strict();

const logHoursSchema = z
  .object({ hours: z.number().min(0), note: z.string().optional() })
  .strict();

module.exports = { volunteerRegisterSchema, volunteerStatusSchema, logHoursSchema };
