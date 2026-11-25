import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { authenticate } from "./auth.js";
import { prisma } from "./db.js";

export const counselorProfilesRouter = Router();

const createProfileSchema = z.object({
  bio: z.string().trim().min(1).max(2000),
  specialty: z.string().trim().min(1).max(100),
  yearsOfExperience: z.int32().nonnegative(),
}).strict();

const updateProfileSchema = createProfileSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Provide a bio, specialty, or years of experience to update."
);

const directoryQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
}).strict();

const counselorNameInclude = {
  user: { select: { name: true } },
};

// ---------- CREATE: own counselor profile ----------

counselorProfilesRouter.post(
  "/",
  authenticate,
  async (req, res) => {
    if (req.user.role !== "COUNSELOR") {
      return res.status(403).json({
        message: "Only counselors can create profiles.",
      });
    }

    const input = createProfileSchema.parse(req.body);

    try {
      const profile = await prisma.counselorProfile.create({
        data: {
          userId: req.user.id,
          ...input,
        },
      });

      res.status(201).json({ profile });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          message: "This counselor already has a profile.",
        });
      }

      throw error;
    }
  }
);

// ---------- READ: counselor profile directory ----------

counselorProfilesRouter.get("/", async (req, res) => {
  const input = directoryQuerySchema.parse(req.query);

  const profiles = await prisma.counselorProfile.findMany({
    where: input.search
      ? {
          OR: [
            {
              specialty: {
                contains: input.search,
              },
            },
            {
              user: {
                name: {
                  contains: input.search,
                },
              },
            },
          ],
        }
      : undefined,
    include: counselorNameInclude,
  });

  res.json({ profiles });
});

// ---------- READ: one counselor profile ----------

counselorProfilesRouter.get("/:id", async (req, res) => {
  const profile = await prisma.counselorProfile.findUnique({
    where: { id: req.params.id },
    include: counselorNameInclude,
  });

  if (!profile) {
    return res.status(404).json({
      message: "Counselor profile not found.",
    });
  }

  res.json({ profile });
});

async function respondToUnmatchedProfile(res, id) {
  if (id) {
    const profile = await prisma.counselorProfile.findUnique({
      where: { id },
      select: { id: true },
    });

    if (profile) {
      return res.status(403).json({
        message: "You can only modify your own counselor profile.",
      });
    }
  }

  return res.status(404).json({
    message: "Counselor profile not found.",
  });
}

const ownProfilePaths = ["/me", "/:id"];

// ---------- UPDATE: own counselor profile ----------

counselorProfilesRouter.patch(ownProfilePaths, authenticate, async (req, res) => {
  if (req.user.role !== "COUNSELOR") {
    return res.status(403).json({
      message: "Only counselors can update profiles.",
    });
  }

  const input = updateProfileSchema.parse(req.body);
  const [profile] = await prisma.counselorProfile.updateManyAndReturn({
    where: { id: req.params.id, userId: req.user.id },
    data: input,
  });

  if (!profile) {
    return respondToUnmatchedProfile(res, req.params.id);
  }

  res.json({ profile });
});

// ---------- DELETE: own counselor profile ----------

counselorProfilesRouter.delete(ownProfilePaths, authenticate, async (req, res) => {
  if (req.user.role !== "COUNSELOR") {
    return res.status(403).json({
      message: "Only counselors can delete profiles.",
    });
  }

  const { count } = await prisma.counselorProfile.deleteMany({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (count === 0) {
    return respondToUnmatchedProfile(res, req.params.id);
  }

  res.status(204).end();
});
