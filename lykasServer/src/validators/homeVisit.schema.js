const { z } = require("zod");

const homeVisitCreateSchema = z
  .object({
    application: z.string().min(1),
    applicant: z.string().min(1).optional(),
    pet: z.string().min(1).optional(),
    scheduledDate: z.string(),
    address: z.string().max(300).optional(),
    assignedTo: z.string().optional(),
  })
  .strict();

const homeVisitUpdateSchema = homeVisitCreateSchema.partial();

const homeVisitCompleteSchema = z
  .object({
    report: z
      .object({
        livingSpace: z.string().optional(),
        safetyCheck: z.enum(["Pass", "Fail", "Needs Improvement"]).optional(),
        yardOrOutdoor: z.string().optional(),
        otherPets: z.string().optional(),
        householdMembers: z.string().optional(),
        overallImpression: z.string().optional(),
        recommendation: z.enum(["Approve", "Reject", "Needs Follow-up"]).optional(),
      })
      .strict()
      .optional(),
    result: z.enum(["passed", "failed", "pending"]),
    notes: z.string().max(2000).optional(),
  })
  .strict();

const homeVisitCancelSchema = z.object({ cancelReason: z.string().max(500).optional() }).strict();

module.exports = { homeVisitCreateSchema, homeVisitUpdateSchema, homeVisitCompleteSchema, homeVisitCancelSchema };
