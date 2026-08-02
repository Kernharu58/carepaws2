const { z } = require("zod");

const applicationCreateSchema = z
  .object({
    pet: z.string().min(1),
    phone: z.string().min(1),
    address: z.string().min(1),
    experience: z.string().optional(),
    householdSize: z.number().min(1).optional(),
    isRenting: z.boolean().optional(),
    landlordApproval: z.boolean().optional(),
    type: z.enum(["adoption", "foster"]).optional(),
    fosterPeriod: z.string().optional(),
  })
  .strict();

const applicationStatusSchema = z
  .object({
    status: z.enum(["pending", "approved", "rejected"]),
    note: z.string().max(2000).optional(),
  })
  .strict();

const applicationStageSchema = z
  .object({
    stage: z.enum([
      "submitted",
      "document_review",
      "interview",
      "home_visit",
      "risk_assessment",
      "approved",
      "adoption_scheduled",
      "completed",
      "rejected",
    ]),
    note: z.string().max(2000).optional(),
  })
  .strict();

module.exports = { applicationCreateSchema, applicationStatusSchema, applicationStageSchema };
