import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

const migration = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  env: {
    ...process.env,
    // Setting a log level avoids a Prisma schema engine failure on macOS.
    RUST_LOG: process.env.RUST_LOG || "info",
  },
  stdio: "inherit",
});

if (migration.error) {
  throw migration.error;
}

process.exitCode = migration.status ?? 1;
