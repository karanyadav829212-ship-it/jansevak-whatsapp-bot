const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "jansevak_verify_123";

// Meta webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// WhatsApp incoming messages
app.post("/webhook", (req, res) => {
  console.log("WhatsApp webhook:", JSON.stringify(req.body, null, 2));

  // Meta ko immediately 200 response
  res.sendStatus(200);
});

// Health check
app.get("/", (req, res) => {
  res.send("JanSevak WhatsApp Bot is running!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
