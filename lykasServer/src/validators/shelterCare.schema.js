const { z } = require("zod");

const healthCheckSchema = z
  .object({
    pet: z.string().min(1),
    date: z.string().optional(),
    weight: z.number().optional(),
    temperature: z.number().optional(),
    condition: z.enum(["Excellent", "Good", "Fair", "Poor", "Critical"]),
    notes: z.string().max(1000).optional(),
    flagged: z.boolean().optional(),
  })
  .strict();

const feedingLogSchema = z
  .object({
    pet: z.string().min(1),
    date: z.string().optional(),
    meal: z.enum(["Morning", "Afternoon", "Evening"]),
    foodType: z.string().max(200).optional(),
    amount: z.string().max(100).optional(),
    eaten: z.enum(["All", "Most", "Half", "Little", "None"]).optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();

const behavioralObsSchema = z
  .object({
    pet: z.string().min(1),
    date: z.string().optional(),
    mood: z.enum(["Happy", "Calm", "Anxious", "Aggressive", "Lethargic", "Playful"]),
    sociability: z.enum(["Friendly", "Neutral", "Shy", "Aggressive"]),
    notes: z.string().max(1000).optional(),
    flagged: z.boolean().optional(),
  })
  .strict();

const cageAssignmentSchema = z
  .object({
    pet: z.string().min(1),
    cageId: z.string().min(1).optional(),
    cageNumber: z.string().min(1).max(50).optional(),
    section: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  })
  .strict()
  .refine((value) => value.cageId || value.cageNumber, { message: "cageId or cageNumber is required" });

const quarantineSchema = z
  .object({
    pet: z.string().min(1),
    startDate: z.string(),
    reason: z.string().min(1).max(500),
    notes: z.string().max(1000).optional(),
  })
  .strict();

module.exports = { healthCheckSchema, feedingLogSchema, behavioralObsSchema, cageAssignmentSchema, quarantineSchema };
