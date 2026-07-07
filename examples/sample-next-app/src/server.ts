import express from "express";

const app = express();
const router = express.Router();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.post("/orders", (req, res) => {
  res.json({ created: true, body: req.body });
});

app.use("/api", router);

app.listen(3001);
