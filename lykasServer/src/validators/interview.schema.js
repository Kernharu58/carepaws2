const { z } = require("zod");

const interviewCreateSchema = z
  .object({
    application: z.string().min(1),
    applicant: z.string().min(1).optional(),
    pet: z.string().min(1).optional(),
    scheduledDate: z.string(),
    method: z.enum(["In-person", "Video call", "Phone call"]),
    location: z.string().max(300).optional(),
    conductedBy: z.string().optional(),
  })
  .strict();

const interviewUpdateSchema = interviewCreateSchema.partial();

const interviewCompleteSchema = z
  .object({
    result: z.enum(["passed", "failed", "pending"]),
    notes: z.string().max(2000).optional(),
  })
  .strict();

const interviewCancelSchema = z.object({ cancelReason: z.string().max(500).optional() }).strict();

module.exports = { interviewCreateSchema, interviewUpdateSchema, interviewCompleteSchema, interviewCancelSchema };
