const { z } = require("zod");
const cfg = require("../config/identity");

// Multipart text fields arrive as strings.
const identityUploadSchema = z
  .object({
    idType: z.enum(cfg.ID_TYPES),
    // The applicant's entry is advisory; the reviewer confirms the real date.
    expiresAt: z.string().trim().max(40).optional(),
  })
  .strict();

const checklistValue = z.enum(["pass", "fail", "na"]);
const checklistShape = Object.fromEntries(cfg.CHECKLIST_ITEMS.map((k) => [k, checklistValue.optional()]));

const identityReviewSchema = z
  .object({
    decision: z.enum(["approve", "reject", "request_resubmission"]),
    checklist: z.object(checklistShape).strict().optional(),
    reason: z.string().trim().max(500).optional(),
    assessmentNote: z.string().trim().max(1000).optional(),
    expiresAt: z.string().trim().max(40).optional(),
  })
  .strict();

const identityPolicySchema = z
  .object({
    adoption: z.enum(cfg.IDENTITY_POLICY_VALUES).optional(),
    foster: z.enum(cfg.IDENTITY_POLICY_VALUES).optional(),
  })
  .strict()
  .refine((v) => v.adoption || v.foster, { message: "Provide adoption and/or foster" });

const identityQueueQuerySchema = z
  .object({
    status: z.enum(["all", ...cfg.DOCUMENT_STATUSES]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().max(100).optional(),
    // The admin DataTable's shared search box sends `q`.
    q: z.string().trim().max(100).optional(),
  })
  .strict();

module.exports = { identityUploadSchema, identityReviewSchema, identityPolicySchema, identityQueueQuerySchema };
