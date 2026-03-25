const express = require("express");
const routes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3003;

const usage = require("@saas/shared/middleware/usageMiddleware");

app.use(express.json());
app.use(usage);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "billing-service", uptime: process.uptime() });
});

app.use("/billing", routes);

app.listen(PORT, () => {
  console.log(`[billing-service] Running on port ${PORT}`);
});
