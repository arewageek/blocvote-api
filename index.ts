import express from "express";
import chairmanRoutes from "./routes/chairman.routes";
import officeRoutes from "./routes/office.routes";
import candidateRoutes from "./routes/candidate.routes";
import voteRoutes from "./routes/vote.routes";
import resultRoutes from "./routes/result.routes";
import botRoutes from "./routes/bot.routes";
import { startBot } from "./services/telegram";

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auto-start Telegram Bot
startBot();

// Map routing modules
app.use("/chairman", chairmanRoutes);
app.use("/office", officeRoutes);
app.use("/candidate", candidateRoutes);
app.use("/", voteRoutes);
app.use("/result", resultRoutes);
app.use("/", botRoutes);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

export { app };
