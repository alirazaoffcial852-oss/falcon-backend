let app;
try {
  const m = require("../dist/app.js");
  app = m.app;
  if (!app) throw new Error("dist/app.js did not export app");
} catch (e) {
  console.error("Failed to load app:", e);
  app = require("express")();
  app.use((_req, res) => {
    res.status(500).json({
      error: "FUNCTION_LOAD_FAILED",
      message: "Backend failed to load. Check Vercel function logs.",
    });
  });
}
module.exports = app;
