const express = require("express");
const mqtt = require("mqtt");

// Локально dotenv нужен, на Render можно не ставить (но не мешает)
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const app = express();
app.use(express.json({ limit: "1mb" }));

// ENV
const {
  TG_SECRET,
  MQTT_URL,     // mqtts://<hostname>:8883
  MQTT_USER,
  MQTT_PASS,
  PORT
} = process.env;

if (!MQTT_URL || !MQTT_USER || !MQTT_PASS) {
  console.error("Missing MQTT env vars. Need MQTT_URL, MQTT_USER, MQTT_PASS");
}

const TOPIC = "oled/text";

// MQTT client (TLS)
const mqttClient = mqtt.connect(MQTT_URL, {
  username: MQTT_USER,
  password: MQTT_PASS,
  reconnectPeriod: 2000,
  keepalive: 30,
  // Render умеет TLS нормально, сертификаты проверяются стандартно
});

mqttClient.on("connect", () => console.log("✅ MQTT connected"));
mqttClient.on("reconnect", () => console.log("… MQTT reconnecting"));
mqttClient.on("error", (e) => console.error("❌ MQTT error", e.message));

// Healthcheck
app.get("/", (req, res) => res.status(200).send("OK"));
app.get("/test-publish", (req, res) => {
  const payload = {
    from: "SERVER_TEST",
    text: "MQTT publish works ✅",
    ts: Date.now()
  };

  mqttClient.publish("oled/text", JSON.stringify(payload), { qos: 0 }, (err) => {
    if (err) {
      console.error("❌ Test publish error:", err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
    return res.json({ ok: true, topic: "oled/text", payload });
  });
});


// Telegram webhook
app.post("/tg-webhook", (req, res) => {
  try {
    // Telegram secret_token приходит в этом заголовке :contentReference[oaicite:8]{index=8}
    const secret = req.get("X-Telegram-Bot-Api-Secret-Token");
    if (TG_SECRET && secret !== TG_SECRET) {
      return res.status(401).send("Unauthorized");
    }

    const update = req.body;

    // Поддержим обычные сообщения и edited_message
    const msg = update.message || update.edited_message;
    if (!msg) return res.status(200).send("No message");

    const text = msg.text || "";
    const fromName =
      (msg.from && (msg.from.first_name || msg.from.username)) || "Unknown";

    if (!text.trim()) return res.status(200).send("Empty text");

    const payload = {
      from: String(fromName).slice(0, 32),
      text: String(text).slice(0, 512), // чтобы не уложить OLED в роман на 20 томов
      ts: Date.now()
    };

    mqttClient.publish(TOPIC, JSON.stringify(payload), { qos: 0 }, (err) => {
      if (err) console.error("❌ Publish error:", err.message);
    });

    // Telegram требует быстро 200 OK :contentReference[oaicite:9]{index=9}
    return res.status(200).send("OK");
  } catch (e) {
    console.error("❌ Webhook handler error:", e);
    return res.status(200).send("OK"); // лучше всегда 200, чтобы TG не долбил ретраями
  }
});

const port = Number(PORT || 3000);
app.listen(port, () => console.log(`🚀 Server listening on ${port}`));
