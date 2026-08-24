const { z } = require("zod");

const score = z.number().int().min(1).max(5);

const riskAssessmentCreateSchema = z
  .object({
    application: z.string().min(1),
    pet: z.string().min(1).optional(),
    applicant: z.string().min(1).optional(),
    scores: z
      .object({
        housingStability: score,
        financialReadiness: score,
        petExperience: score,
        lifestyleMatch: score,
        familyCommitment: score,
        knowledgeOfPet: score,
      })
      .strict(),
    notes: z.string().max(2000).optional(),
    redFlags: z.array(z.string()).optional(),
    recommendation: z.enum(["Approve", "Reject", "Further Review"]).optional(),
  })
  .strict();

const riskAssessmentUpdateSchema = riskAssessmentCreateSchema
  .partial()
  .extend({ scores: riskAssessmentCreateSchema.shape.scores.partial().optional() });

module.exports = { riskAssessmentCreateSchema, riskAssessmentUpdateSchema };
