import "dotenv/config";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// Only these fields can appear in account responses.
export const publicUserFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
};