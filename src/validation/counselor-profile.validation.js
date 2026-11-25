import { z } from "zod";

export const createProfileSchema = z.object({
  bio: z.string().trim().min(1).max(2000),
  specialty: z.string().trim().min(1).max(100),
  yearsOfExperience: z.int32().nonnegative(),
}).strict();

export const updateProfileSchema = createProfileSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Provide a bio, specialty, or years of experience to update."
);

export const directoryQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
}).strict();
