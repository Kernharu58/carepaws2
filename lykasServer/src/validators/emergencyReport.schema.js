const { z } = require("zod");

const emergencyReportCreateSchema = z
  .object({
    type: z.preprocess((value) => ({ stray: "stray_animal", injured: "injured_animal", abused: "abuse_report", abandoned: "abandoned_animal" })[value] || value, z.enum(["stray_animal", "injured_animal", "abuse_report", "abandoned_animal", "other"])),
    animalType: z.string().max(100).optional(),
    description: z.string().min(1).max(2000),
    photos: z.array(z.string().url()).max(5).optional(),
    location: z.string().max(300).optional(),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).strict().optional(),
    contactName: z.string().max(200).optional(),
    contactPhone: z.string().max(30).optional(),
  })
  .strict();

const emergencyReportUpdateSchema = z
  .object({
    status: z.enum(["open", "in_progress", "resolved", "dismissed"]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    assignedTo: z.string().optional(),
    resolutionNote: z.string().max(1000).optional(),
    linkedPet: z.string().optional(),
  })
  .strict();

module.exports = { emergencyReportCreateSchema, emergencyReportUpdateSchema };
