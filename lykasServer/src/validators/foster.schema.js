const { z } = require("zod");

const fosterCreateSchema = z
  .object({
    pet: z.string().min(1),
    fosterer: z.string().min(1),
    application: z.string().optional(),
    startDate: z.string(),
    expectedEndDate: z.string().optional(),
    trialDurationDays: z.number().optional(),
    weeklyReportsRequired: z.number().optional(),
    fosterAgreementSigned: z.boolean().optional(),
    pickupNotes: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

const fosterEndSchema = z
  .object({
    outcome: z.enum(["ADOPTED", "RETURNED", "EXTENDED"]),
    returnNotes: z.string().optional(),
    staffNotes: z.string().optional(),
  })
  .strict();

const weeklyReportSchema = z
  .object({
    weekNumber: z.number().int().positive(),
    weightChange: z.number().optional(),
    appetite: z.enum(["Excellent", "Good", "Fair", "Poor"]).optional(),
    energy: z.enum(["Very Active", "Active", "Low", "Lethargic"]).optional(),
    behavior: z.string().optional(),
    healthConcerns: z.string().optional(),
    vetVisitRequired: z.boolean().optional(),
    overallProgress: z.enum(["Excellent", "Good", "Fair", "Needs Attention"]).optional(),
    notes: z.string().optional(),
  })
  .strict();

module.exports = { fosterCreateSchema, fosterEndSchema, weeklyReportSchema };
