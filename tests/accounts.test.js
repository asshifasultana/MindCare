import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
} from "vitest";

import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

let app;
let prisma;
let testDirectory;

const account = {
  name: "Asshifa",
  email: "asshifa@example.com",
  password: "Learning123!",
};

function applyTestMigrations(databasePath) {
  const migrationsPath = fileURLToPath(
    new URL("../prisma/migrations/", import.meta.url)
  );
  const migrationNames = readdirSync(migrationsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  // Run the migration SQL on the temporary database inside the test worker.
  const database = new DatabaseSync(databasePath);
  try {
    for (const name of migrationNames) {
      const sql = readFileSync(path.join(migrationsPath, name, "migration.sql"), "utf8");
      database.exec(sql);
    }
  } finally {
    database.close();
  }
}

beforeAll(async () => {
  testDirectory = mkdtempSync(
    path.join(tmpdir(), "mindcare-test-")
  );

  const databasePath = path
    .join(testDirectory, "test.db")
    .replaceAll("\\", "/");

  // Override the development settings before importing the app.
  process.env.DATABASE_URL = `file:${databasePath}`;
  process.env.JWT_SECRET =
    "test-only-mindcare-secret-at-least-32-characters";

  applyTestMigrations(databasePath);
  ({ app } = await import("../src/app.js"));
  ({ prisma } = await import("../src/db.js"));
}, 60000);

beforeEach(async () => {
  // This Prisma client connects only to the temporary database.
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma?.$disconnect();

  if (testDirectory) {
    rmSync(testDirectory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
});

async function registerAndLogin(input = account) {
  const registration = await request(app)
    .post("/api/auth/register")
    .send(input)
    .expect(201);

  const login = await request(app)
    .post("/api/auth/login")
    .send({
      email: input.email,
      password: input.password,
    })
    .expect(200);

  return {
    user: registration.body.user,
    token: login.body.token,
  };
}

describe("Account API integration tests", () => {
  it("creates an account and stores a hashed password", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(account)
      .expect(201);

    expect(response.body.user.email).toBe(account.email);
    expect(response.body.user.role).toBe("CLIENT");
    expect(response.body.user).not.toHaveProperty("password");
    expect(response.body.user).not.toHaveProperty("passwordHash");

    const stored = await prisma.user.findUnique({
      where: { email: account.email },
    });

    expect(stored.passwordHash).not.toBe(account.password);

    const matches = await bcrypt.compare(
      account.password,
      stored.passwordHash
    );

    expect(matches).toBe(true);
  });

  it("allows counselor registration", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ ...account, role: "COUNSELOR" })
      .expect(201);

    expect(response.body.user.role).toBe("COUNSELOR");
  });

  it("rejects duplicate emails regardless of case", async () => {
    await registerAndLogin();

    await request(app)
      .post("/api/auth/register")
      .send({
        ...account,
        email: account.email.toUpperCase(),
      })
      .expect(409);

    expect(await prisma.user.count()).toBe(1);
  });

  it.each([
    { name: "" },
    { email: "invalid-email" },
    { password: "123" },
    { role: "ADMIN" },
    { password: "a".repeat(73) },
  ])("rejects invalid registration: %j", async (invalid) => {
    await request(app)
      .post("/api/auth/register")
      .send({ ...account, ...invalid })
      .expect(400);

    expect(await prisma.user.count()).toBe(0);
  });

  it("returns a usable token that expires in one hour", async () => {
    const { user, token } = await registerAndLogin();

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    expect(payload.sub).toBe(user.id);
    expect(payload.exp - payload.iat).toBe(3600);

    const response = await request(app)
      .get("/api/users/me")
      .auth(token, { type: "bearer" })
      .expect(200);

    expect(response.body.user.id).toBe(user.id);
    expect(response.body.user).not.toHaveProperty("passwordHash");
  });

  it("rejects the wrong password and unknown email", async () => {
    await registerAndLogin();

    await request(app)
      .post("/api/auth/login")
      .send({
        email: account.email,
        password: "WrongPassword123!",
      })
      .expect(401);

    await request(app)
      .post("/api/auth/login")
      .send({
        email: "missing@example.com",
        password: account.password,
      })
      .expect(401);
  });

  it.each(["get", "patch", "delete"])(
    "requires login for %s /api/users/me",
    async (method) => {
      await request(app)[method]("/api/users/me")
        .send({ name: "Changed" })
        .expect(401);
    }
  );

  it("rejects invalid and expired tokens", async () => {
    const { user } = await registerAndLogin();

    await request(app)
      .get("/api/users/me")
      .auth("invalid-token", { type: "bearer" })
      .expect(401);

    const expiredToken = jwt.sign(
      {},
      process.env.JWT_SECRET,
      {
        subject: user.id,
        expiresIn: -1,
      }
    );

    await request(app)
      .get("/api/users/me")
      .auth(expiredToken, { type: "bearer" })
      .expect(401);
  });

  it("updates the name and persists the change", async () => {
    const { token } = await registerAndLogin();

    await request(app)
      .patch("/api/users/me")
      .auth(token, { type: "bearer" })
      .send({ name: "Asshifa Updated" })
      .expect(200);

    const response = await request(app)
      .get("/api/users/me")
      .auth(token, { type: "bearer" })
      .expect(200);

    expect(response.body.user.name).toBe("Asshifa Updated");
  });

  it("updates the password and rejects the old password", async () => {
    const { token } = await registerAndLogin();

    await request(app)
      .patch("/api/users/me")
      .auth(token, { type: "bearer" })
      .send({ password: "NewPassword123!" })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({
        email: account.email,
        password: account.password,
      })
      .expect(401);

    await request(app)
      .post("/api/auth/login")
      .send({
        email: account.email,
        password: "NewPassword123!",
      })
      .expect(200);
  });

  it.each([
    {},
    { role: "COUNSELOR" },
    { email: "another@example.com" },
    { password: "short" },
    { name: "" },
  ])("rejects invalid updates: %j", async (changes) => {
    const { token } = await registerAndLogin();

    await request(app)
      .patch("/api/users/me")
      .auth(token, { type: "bearer" })
      .send(changes)
      .expect(400);
  });

  it("cannot update another account by submitting its ID", async () => {
    const first = await registerAndLogin();

    const second = await registerAndLogin({
      ...account,
      name: "Other User",
      email: "other@example.com",
    });

    await request(app)
      .patch("/api/users/me")
      .auth(first.token, { type: "bearer" })
      .send({
        id: second.user.id,
        name: "Unauthorized Change",
      })
      .expect(400);

    const response = await request(app)
      .get("/api/users/me")
      .auth(second.token, { type: "bearer" })
      .expect(200);

    expect(response.body.user.name).toBe("Other User");
  });

  it("deletes only the logged-in account", async () => {
    const first = await registerAndLogin();

    const second = await registerAndLogin({
      ...account,
      email: "other@example.com",
    });

    await request(app)
      .delete("/api/users/me")
      .auth(first.token, { type: "bearer" })
      .expect(204);

    const deleted = await prisma.user.findUnique({
      where: { id: first.user.id },
    });

    expect(deleted).toBeNull();

    await request(app)
      .get("/api/users/me")
      .auth(first.token, { type: "bearer" })
      .expect(401);

    await request(app)
      .get("/api/users/me")
      .auth(second.token, { type: "bearer" })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({
        email: account.email,
        password: account.password,
      })
      .expect(401);
  });

  it("completes the full create-read-update-delete lifecycle", async () => {
    // CREATE and LOGIN
    const { token } = await registerAndLogin();

    // READ
    const initial = await request(app)
      .get("/api/users/me")
      .auth(token, { type: "bearer" })
      .expect(200);

    expect(initial.body.user.name).toBe("Asshifa");

    // UPDATE
    await request(app)
      .patch("/api/users/me")
      .auth(token, { type: "bearer" })
      .send({ name: "Lifecycle Updated" })
      .expect(200);

    // Confirm the update was saved.
    const updated = await request(app)
      .get("/api/users/me")
      .auth(token, { type: "bearer" })
      .expect(200);

    expect(updated.body.user.name).toBe("Lifecycle Updated");

    // DELETE
    await request(app)
      .delete("/api/users/me")
      .auth(token, { type: "bearer" })
      .expect(204);

    // Confirm deletion in both database and API.
    expect(await prisma.user.count()).toBe(0);

    await request(app)
      .get("/api/users/me")
      .auth(token, { type: "bearer" })
      .expect(401);
  });
});

describe("Counselor profile API integration tests", () => {
  const directory = "/api/counselor-profiles";
  const ownProfile = "/api/counselor-profiles/me";
  const profile = {
    bio: "A sample counselor profile.",
    specialty: "Stress management",
    yearsOfExperience: 5,
  };

  it("creates, lists, reads, updates, and deletes a profile by ID", async () => {
    const counselor = await registerAndLogin({
      ...account,
      role: "COUNSELOR",
    });
    const other = await registerAndLogin({
      ...account,
      name: "Other Counselor",
      email: "other-counselor@example.com",
      role: "COUNSELOR",
    });

    for (const token of [counselor.token, other.token]) {
      await request(app)
        .post(directory)
        .auth(token, { type: "bearer" })
        .send(profile)
        .expect(201);
    }

    await request(app)
      .post(directory)
      .auth(counselor.token, { type: "bearer" })
      .send(profile)
      .expect(409, { message: "This counselor already has a profile." });

    const matching = await request(app)
      .get(directory)
      .query({ search: `  ${account.name}  ` })
      .expect(200);

    expect(matching.body.profiles).toHaveLength(1);
    const [listedProfile] = matching.body.profiles;
    expect(listedProfile.user).toEqual({ name: account.name });

    const profileById = `${directory}/${listedProfile.id}`;
    const detail = await request(app).get(profileById).expect(200);
    expect(detail.body.profile).toEqual(listedProfile);

    await request(app)
      .patch(profileById)
      .auth(other.token, { type: "bearer" })
      .send({ specialty: "Attempted change" })
      .expect(403);
    await request(app)
      .delete(profileById)
      .auth(other.token, { type: "bearer" })
      .expect(403);
    await request(app).get(profileById).expect(200, detail.body);

    const updated = await request(app)
      .patch(profileById)
      .auth(counselor.token, { type: "bearer" })
      .send({ specialty: "Sleep support" })
      .expect(200);

    expect(updated.body.profile).toMatchObject({
      ...profile,
      userId: counselor.user.id,
      specialty: "Sleep support",
    });

    const matchingSpecialty = await request(app)
      .get(directory)
      .query({ search: "Sleep" })
      .expect(200);
    expect(matchingSpecialty.body.profiles.map(({ userId }) => userId))
      .toEqual([counselor.user.id]);

    await request(app)
      .delete(profileById)
      .auth(counselor.token, { type: "bearer" })
      .expect(204, "");

    const notFound = { message: "Counselor profile not found." };
    await request(app).get(profileById).expect(404, notFound);
    await request(app)
      .patch(profileById)
      .auth(counselor.token, { type: "bearer" })
      .send({ specialty: "Sleep support" })
      .expect(404, notFound);
    await request(app)
      .delete(profileById)
      .auth(counselor.token, { type: "bearer" })
      .expect(404, notFound);

    const remaining = await request(app).get(directory).expect(200);
    expect(remaining.body.profiles).toHaveLength(1);
    expect(remaining.body.profiles[0]).toMatchObject({
      ...profile,
      userId: other.user.id,
    });

    await request(app)
      .get("/api/users/me")
      .auth(counselor.token, { type: "bearer" })
      .expect(200);
  });

  it("requires a counselor login to create, update, or delete a profile", async () => {
    const { token } = await registerAndLogin();

    await request(app).post(directory).send(profile).expect(401);
    await request(app)
      .post(directory)
      .auth(token, { type: "bearer" })
      .send(profile)
      .expect(403);

    const profileById = `${directory}/missing-profile`;
    for (const method of ["patch", "delete"]) {
      await request(app)[method](profileById).expect(401);
      await request(app)[method](profileById)
        .auth(token, { type: "bearer" })
        .expect(403);
    }
  });

  it("rejects invalid fields when creating a profile", async () => {
    const { token } = await registerAndLogin({
      ...account,
      role: "COUNSELOR",
    });

    for (const fields of [
      { bio: "   " },
      { specialty: "" },
      { yearsOfExperience: -1 },
      { yearsOfExperience: 1.5 },
      { yearsOfExperience: 2_147_483_648 },
      { userId: "another-user" },
    ]) {
      await request(app)
        .post(directory)
        .auth(token, { type: "bearer" })
        .send({ ...profile, ...fields })
        .expect(400);
    }

    await request(app).get(directory).expect(200, { profiles: [] });
  });

  it("validates profile updates and reports missing profiles", async () => {
    const { token } = await registerAndLogin({
      ...account,
      role: "COUNSELOR",
    });

    for (const body of [{}, { userId: "other-user" }, { yearsOfExperience: -1 }]) {
      await request(app)
        .patch(ownProfile)
        .auth(token, { type: "bearer" })
        .send(body)
        .expect(400);
    }

    const notFound = { message: "Counselor profile not found." };
    await request(app)
      .patch(ownProfile)
      .auth(token, { type: "bearer" })
      .send({ bio: "Updated bio" })
      .expect(404, notFound);
    await request(app)
      .delete(ownProfile)
      .auth(token, { type: "bearer" })
      .expect(404, notFound);
  });

  it("still accepts /me for updating and deleting one's own profile", async () => {
    const { token } = await registerAndLogin({
      ...account,
      role: "COUNSELOR",
    });

    await request(app)
      .post(directory)
      .auth(token, { type: "bearer" })
      .send(profile)
      .expect(201);
    const updated = await request(app)
      .patch(ownProfile)
      .auth(token, { type: "bearer" })
      .send({ yearsOfExperience: 0 })
      .expect(200);
    expect(updated.body.profile.yearsOfExperience).toBe(0);
    await request(app)
      .delete(ownProfile)
      .auth(token, { type: "bearer" })
      .expect(204, "");
  });

  it("deletes a profile when its owner deletes their account", async () => {
    const { token } = await registerAndLogin({
      ...account,
      role: "COUNSELOR",
    });

    const created = await request(app)
      .post(directory)
      .auth(token, { type: "bearer" })
      .send(profile)
      .expect(201);
    const profileById = `${directory}/${created.body.profile.id}`;
    await request(app).get(profileById).expect(200);
    await request(app)
      .delete("/api/users/me")
      .auth(token, { type: "bearer" })
      .expect(204, "");
    await request(app).get(profileById).expect(404);
  });
});
