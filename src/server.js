import { app } from "./app.js";
import { prisma } from "./db.js";

const port = Number(process.env.PORT ?? 3000);

await prisma.$connect();

app.listen(port, () => {
  console.log(
    `MindCare API running at http://localhost:${port}`
  );
});