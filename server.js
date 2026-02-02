import express from "express";

const app = express();
app.use(express.json());

let latestText = "Waiting...";

// Telegram webhook endpoint
app.post("/tg-webhook", (req, res) => {
  const msg = req.body?.message?.text;
  if (typeof msg === "string" && msg.trim().length > 0) {
    latestText = msg.trim().slice(0, 200); // ограничим длину
    console.log("New message:", latestText);
  }
  res.sendStatus(200);
});

// ESP32 pulls latest message
app.get("/latest", (req, res) => {
  res.json({ text: latestText });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server listening on", port));
