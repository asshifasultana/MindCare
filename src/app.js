import express from "express";
import { fileURLToPath } from "node:url";
import { accountsRouter } from "./routes/account.routes.js";
import { counselorProfilesRouter } from "./routes/counselor-profile.routes.js";
import { notFound, errorHandler } from "./middleware/error-handler.js";

export const app = express();

app.use(express.json({ limit: "16kb" }));

// Serve the browser interface from the same origin as the API.
const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));
app.use(express.static(publicDirectory));

app.use("/api", accountsRouter);
app.use("/api/counselor-profiles", counselorProfilesRouter);

app.use(notFound);
// Express 5 forwards errors from async endpoints here.
app.use(errorHandler);
