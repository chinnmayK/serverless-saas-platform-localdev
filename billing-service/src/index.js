require('./tracing');
const express = require("express");
const routes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3000;

const usage = require("@saas/shared/middleware/usageMiddleware");

// CRITICAL: webhook must be before json() middleware
app.use("/billing", routes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "billing-service", uptime: process.uptime() });
});

app.use(express.json());

app.listen(PORT, () => {
  console.log(`[billing-service] Running on port ${PORT}`);
});
