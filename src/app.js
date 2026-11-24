import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { prisma, publicUserFields } from "./db.js";
import { authenticate, jwtSecret } from "./auth.js";

export const app = express();

app.use(express.json({ limit: "16kb" }));

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

app.post("/api/auth/register", async (req, res) => {
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

app.post("/api/auth/login", async (req, res) => {
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

app.get("/api/users/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: publicUserFields,
  });

  res.json({ user });
});

// ---------- UPDATE: own account ----------

app.patch("/api/users/me", authenticate, async (req, res) => {
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

app.delete("/api/users/me", authenticate, async (req, res) => {
  await prisma.user.delete({
    where: { id: req.user.id },
  });

  res.status(204).end();
});

// ---------- Unknown routes ----------

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found.",
  });
});

// ---------- Central error handler ----------

// Express 5 forwards errors from async endpoints here.
app.use((error, req, res, next) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Invalid input.",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // Prisma unique-constraint error.
  if (error.code === "P2002") {
    return res.status(409).json({
      message: "An account with this email already exists.",
    });
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Invalid JSON.",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request body too large.",
    });
  }

  console.error(error);

  res.status(500).json({
    message: "Something went wrong.",
  });
});