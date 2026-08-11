const { z } = require("zod");

const vaccinationSchema = z
  .object({
    pet: z.string().min(1),
    vaccineName: z.string().min(1).max(200),
    dateGiven: z.string(),
    nextDueDate: z.string().optional(),
    administeredBy: z.string().max(200).optional(),
    batchNumber: z.string().max(100).optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();

const vetVisitSchema = z
  .object({
    pet: z.string().min(1),
    visitDate: z.string(),
    reason: z.string().min(1).max(500),
    vetName: z.string().max(200).optional(),
    clinic: z.string().max(200).optional(),
    diagnosis: z.string().max(1000).optional(),
    treatment: z.string().max(1000).optional(),
    prescription: z.string().max(1000).optional(),
    followUpDate: z.string().optional(),
    cost: z.number().min(0).optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();

const generalRecordSchema = z
  .object({
    pet: z.string().min(1),
    type: z.enum(["Surgery", "Deworming", "Flea Treatment", "Dental", "Spay/Neuter", "Injury", "Illness", "Other"]),
    date: z.string(),
    description: z.string().max(1000).optional(),
    performedBy: z.string().max(200).optional(),
    outcome: z.string().max(500).optional(),
    followUpRequired: z.boolean().optional(),
    followUpDate: z.string().optional(),
    cost: z.number().min(0).optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();

module.exports = { vaccinationSchema, vetVisitSchema, generalRecordSchema };
