const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// Webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Receive WhatsApp messages
app.post("/webhook", async (req, res) => {
  console.log("WhatsApp webhook:", JSON.stringify(req.body, null, 2));

  try {
    const message =
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text?.body?.trim().toLowerCase();

    if (message.type === "text" && (text === "hi" || text === "hello")) {
      await sendWelcomeMessage(from);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    return res.sendStatus(500);
  }
});

// Send JanSevak Welcome Message
async function sendWelcomeMessage(to) {
  const url =
    `https://graph.facebook.com/v26.0/${PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: {
        body:
`👋 Namaste!

🇮🇳 JanSevak mein aapka swagat hai.

Main aapko government schemes aur public services ki information dhoondhne mein help kar sakta hoon.

Aap kya karna chahte hain?

1️⃣ Government Scheme
2️⃣ Eligibility Check
3️⃣ Documents
4️⃣ Apply Process
5️⃣ Help / Complaint

Bas option number ya apna sawaal bhejiye.`
      }
    })
  });

  const data = await response.json();
  console.log("WhatsApp API response:", data);
}

// Health check
app.get("/", (req, res) => {
  res.send("JanSevak WhatsApp Bot is running!");
});

app.listen(PORT, () => {
  console.log(`JanSevak server running on port ${PORT}`);
});
