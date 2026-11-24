import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { authenticate, jwtSecret } from "./auth.js";
import { prisma, publicUserFields } from "./db.js";

export const accountsRouter = Router();

// ---------- Validation ----------

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

const registrationSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
  role: z.enum(["CLIENT", "COUNSELOR"]).default("CLIENT"),
}).strict();

const loginSchema = z.object({
  email: emailField,
  password: passwordField,
}).strict();

const updateSchema = z.object({
  name: nameField.optional(),
  password: passwordField.optional(),
}).strict().refine(
  (data) => Object.keys(data).length > 0,
  "Provide a name or password to update."
);

// ---------- CREATE: register ----------

accountsRouter.post("/auth/register", async (req, res) => {
  const input = registrationSchema.parse(req.body);

  const passwordHash = await bcrypt.hash(
    input.password,
    10
  );

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    },
    select: publicUserFields,
  });

  res.status(201).json({ user });
});

// ---------- LOGIN ----------

accountsRouter.post("/auth/login", async (req, res) => {
  const input = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  const correctPassword = await bcrypt.compare(
    input.password,
    user.passwordHash
  );

  if (!correctPassword) {
    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  const token = jwt.sign({}, jwtSecret, {
    algorithm: "HS256",
    subject: user.id,
    expiresIn: "1h",
  });

  res.json({
    token,
    tokenType: "Bearer",
    expiresIn: 3600,
  });
});

// ---------- READ: own account ----------

accountsRouter.get("/users/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: publicUserFields,
  });

  res.json({ user });
});

// ---------- UPDATE: own account ----------

accountsRouter.patch("/users/me", authenticate, async (req, res) => {
  const input = updateSchema.parse(req.body);
  const changes = {};

  if (input.name !== undefined) {
    changes.name = input.name;
  }

  if (input.password !== undefined) {
    changes.passwordHash = await bcrypt.hash(
      input.password,
      10
    );
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: changes,
    select: publicUserFields,
  });

  res.json({ user });
});

// ---------- DELETE: own account ----------

accountsRouter.delete("/users/me", authenticate, async (req, res) => {
  await prisma.user.delete({
    where: { id: req.user.id },
  });

  res.status(204).end();
});
