import { prisma } from "../config/database.js";

// Only these fields can appear in account responses.
const publicUserFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
};

export function createUser(data) {
  return prisma.user.create({ data, select: publicUserFields });
}

export function findUserByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

export function findPublicUserById(id) {
  return prisma.user.findUnique({ where: { id }, select: publicUserFields });
}

export function findAuthenticatedUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
}

export function updateUser(id, data) {
  return prisma.user.update({ where: { id }, data, select: publicUserFields });
}

export function deleteUser(id) {
  return prisma.user.delete({ where: { id } });
}
