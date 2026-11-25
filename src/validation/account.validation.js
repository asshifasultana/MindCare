import { z } from "zod";

const nameField = z.string()
  .trim()
  .min(1)
  .max(100);

const emailField = z.string()
  .trim()
  .toLowerCase()
  .max(254)
  .email();

const passwordField = z.string()
  .min(8)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password must be at most 72 UTF-8 bytes."
  );

export const registrationSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
  role: z.enum(["CLIENT", "COUNSELOR"]).default("CLIENT"),
}).strict();

export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
}).strict();

export const updateSchema = z.object({
  name: nameField.optional(),
  password: passwordField.optional(),
}).strict().refine(
  (data) => Object.keys(data).length > 0,
  "Provide a name or password to update."
);
