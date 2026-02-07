import express from "express";
import { errorHandler } from "./middleware/errorHandler";
import { requestObservability } from "./middleware/requestObservability";
import { requestLatencyMetrics } from "./observability/requestMetrics";
import { registerWedgeRoutes } from "../routes/wedge";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(requestObservability);

// Register Wedge Routes (for YC Demo)
registerWedgeRoutes(app);

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    metrics: requestLatencyMetrics.snapshot(),
  });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    name: "VitalCV API",
    version: "mvp"
  });
});

app.use(errorHandler);

export default app;
