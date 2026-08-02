const { z } = require("zod");

const score = z.number().int().min(1).max(5);

const riskAssessmentCreateSchema = z
  .object({
    application: z.string().min(1),
    pet: z.string().min(1),
    applicant: z.string().min(1),
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

module.exports = { riskAssessmentCreateSchema };
