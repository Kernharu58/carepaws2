const { z } = require("zod");

const userDocumentVerifySchema = z
  .object({
    status: z.enum(["pending", "verified", "rejected"]),
    rejectedReason: z.string().max(500).optional(),
  })
  .strict();

module.exports = { userDocumentVerifySchema };
