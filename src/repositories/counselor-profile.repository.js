import { prisma } from "../config/database.js";

const counselorNameInclude = {
  user: { select: { name: true } },
};

export function createProfile(userId, data) {
  return prisma.counselorProfile.create({ data: { userId, ...data } });
}

export function listProfiles(search) {
  return prisma.counselorProfile.findMany({
    where: search
      ? {
          OR: [
            { specialty: { contains: search } },
            { user: { name: { contains: search } } },
          ],
        }
      : undefined,
    include: counselorNameInclude,
  });
}

export function findProfileById(id) {
  return prisma.counselorProfile.findUnique({
    where: { id },
    include: counselorNameInclude,
  });
}

export function findProfileIdentityById(id) {
  return prisma.counselorProfile.findUnique({
    where: { id },
    select: { id: true },
  });
}

export async function updateOwnProfile(userId, id, data) {
  const [profile] = await prisma.counselorProfile.updateManyAndReturn({
    where: { id, userId },
    data,
  });
  return profile;
}

export async function deleteOwnProfile(userId, id) {
  const { count } = await prisma.counselorProfile.deleteMany({
    where: { id, userId },
  });
  return count;
}
