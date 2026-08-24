const { z } = require("zod");

const monitoringReportCreateSchema = z
  .object({
    application: z.string().optional(),
    monitoringPeriod: z.coerce.number().int().min(1).optional(),
    pet: z.string().optional(),
    currentWeight: z.number().optional(),
    diet: z.string().max(500).optional(),
    exerciseRoutine: z.string().max(500).optional(),
    vetVisits: z.string().max(500).optional(),
    overallCondition: z.enum(["Excellent", "Good", "Fair", "Poor"]),
    behaviorAtHome: z.string().max(1000).optional(),
    issuesOrConcerns: z.string().max(1000).optional(),
    additionalPets: z.string().max(500).optional(),
    satisfactionRating: z.number().int().min(1).max(5).optional(),
    comments: z.string().max(1000).optional(),
  })
  .strict();

const monitoringReportReviewSchema = z
  .object({
    status: z.enum(["reviewed", "flagged"]).optional(),
    adminNotes: z.string().max(1000).optional(),
  })
  .strict();

module.exports = { monitoringReportCreateSchema, monitoringReportReviewSchema };
