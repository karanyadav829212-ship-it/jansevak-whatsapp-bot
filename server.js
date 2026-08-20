const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// Google Sheet
const SHEET_ID = "1GeXblMObkNM-KDmMhQPY4ZA8Gv180L_eqb7aNteDu88";
const SHEET_NAME = "Sheet1";

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

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body?.trim().toLowerCase();

    if (message.type === "text") {

      if (text === "hi" || text === "hello") {
        await sendWelcomeMessage(from);
      }

      else if (text === "1") {
        const schemes = await getSchemes();
        await sendTextMessage(from, schemes);
      }

      else {
        await sendTextMessage(
          from,
          "🙏 Kripya 1, 2, 3, 4 ya 5 bhejiye."
        );
      }
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
});

// Read Google Sheet
async function getSchemes() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;

  const response = await fetch(url);
  const text = await response.text();

  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  let msg = "📋 *Government Schemes*\n\n";

  rows.forEach((row, index) => {
    const name = row.c[0]?.v || "No Name";
    msg += `${index + 1}. ${name}\n`;
  });

  return msg;
}

// Send text message
async function sendTextMessage(to, body) {
  const url = `https://graph.facebook.com/v26.0/${PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body }
    })
  });

  const data = await response.json();
  console.log("WhatsApp API response:", data);
}

// Welcome message
async function sendWelcomeMessage(to) {
  await sendTextMessage(
    to,
`👋 Namaste!

🇮🇳 JanSevak mein aapka swagat hai.

Main aapko government schemes aur public services ki information dhoondhne mein help kar sakta hoon.

1️⃣ Government Scheme
2️⃣ Eligibility Check
3️⃣ Documents
4️⃣ Apply Process
5️⃣ Help / Complaint

Bas option number bhejiye.`
  );
}

app.get("/", (req, res) => {
  res.send("JanSevak WhatsApp Bot is running!");
});

app.listen(PORT, () => {
  console.log(`JanSevak server running on port ${PORT}`);
});
