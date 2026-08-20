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

// User language/page memory
const users = {};

// ===============================
// WEBHOOK VERIFICATION
// ===============================

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ===============================
// RECEIVE WHATSAPP MESSAGES
// ===============================

app.post("/webhook", async (req, res) => {
  console.log("WhatsApp webhook:", JSON.stringify(req.body, null, 2));

  try {
    const message =
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;

    // --------------------------------
    // BUTTON RESPONSE
    // --------------------------------

    if (message.type === "interactive") {
      const interactive = message.interactive;

      if (interactive?.type === "button_reply") {
        const buttonId = interactive.button_reply.id;

        await handleButton(from, buttonId);

        return res.sendStatus(200);
      }
    }

    // --------------------------------
    // TEXT MESSAGE
    // --------------------------------

    if (message.type === "text") {
      const text = message.text?.body?.trim();

      await handleText(from, text);

      return res.sendStatus(200);
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error("Webhook error:", error);
    return res.sendStatus(500);
  }
});

// ===============================
// HANDLE TEXT
// ===============================

async function handleText(from, originalText) {

  const text = originalText.toLowerCase().trim();

  // First greeting
  if (
    text === "hi" ||
    text === "hello" ||
    text === "hey" ||
    text === "namaste" ||
    text === "start"
  ) {
    await sendLanguageMenu(from);
    return;
  }

  // Language selection by text
  if (text === "hindi" || text === "हिंदी") {
    users[from] = {
      language: "hi",
      page: 0
    };

    await sendMainMenu(from);
    return;
  }

  if (text === "english") {
    users[from] = {
      language: "en",
      page: 0
    };

    await sendMainMenu(from);
    return;
  }

  if (text === "hinglish") {
    users[from] = {
      language: "hinglish",
      page: 0
    };

    await sendMainMenu(from);
    return;
  }

  // Direct scheme ID
  if (/^jh-\d+$/i.test(text)) {

    const schemes = await getSchemeData();

    const scheme = schemes.find(
      s => s.id.toLowerCase() === text.toLowerCase()
    );

    if (scheme) {
      await sendSchemeDetails(from, scheme);
    } else {
      await sendTextMessage(
        from,
        "❌ Scheme nahi mili.\n\nExample: JH-001"
      );
    }

    return;
  }

  // Number selection
  if (/^\d+$/.test(text)) {

    const number = parseInt(text);

    const schemes = await getSchemeData();

    if (number >= 1 && number <= schemes.length) {

      await sendSchemeDetails(
        from,
        schemes[number - 1]
      );

    } else {
      await sendTextMessage(
        from,
        "🙏 Kripya valid option choose karein."
      );
    }

    return;
  }

  // Unknown text
  await sendLanguageMenu(from);
}

// ===============================
// HANDLE BUTTONS
// ===============================

async function handleButton(from, buttonId) {

  // Language buttons
  if (buttonId === "lang_hi") {

    users[from] = {
      language: "hi",
      page: 0
    };

    await sendMainMenu(from);
    return;
  }

  if (buttonId === "lang_en") {

    users[from] = {
      language: "en",
      page: 0
    };

    await sendMainMenu(from);
    return;
  }

  if (buttonId === "lang_hinglish") {

    users[from] = {
      language: "hinglish",
      page: 0
    };

    await sendMainMenu(from);
    return;
  }

  // Main menu
  if (buttonId === "menu_schemes") {

    if (!users[from]) {
      users[from] = {
        language: "hinglish",
        page: 0
      };
    }

    users[from].page = 0;

    await sendSchemeMenu(from);
    return;
  }

  // Language change
  if (buttonId === "change_language") {
    await sendLanguageMenu(from);
    return;
  }

  // Main menu button
  if (buttonId === "main_menu") {
    await sendMainMenu(from);
    return;
  }

  // Next page
  if (buttonId === "schemes_next") {

    if (!users[from]) {
      users[from] = {
        language: "hinglish",
        page: 0
      };
    }

    users[from].page++;

    await sendSchemeMenu(from);
    return;
  }

  // Previous page
  if (buttonId === "schemes_back") {

    if (!users[from]) {
      users[from] = {
        language: "hinglish",
        page: 0
      };
    }

    users[from].page = Math.max(
      0,
      users[from].page - 1
    );

    await sendSchemeMenu(from);
    return;
  }

  // Scheme button
  if (buttonId.startsWith("scheme_")) {

    const id = buttonId.replace("scheme_", "");

    const schemes = await getSchemeData();

    const scheme = schemes.find(
      s => s.id === id
    );

    if (scheme) {
      await sendSchemeDetails(from, scheme);
    }

    return;
  }
}

// ===============================
// LANGUAGE MENU
// ===============================

async function sendLanguageMenu(to) {

  await sendButtonMessage(
    to,
    "👋 *Welcome to JanSevak!*\n\n🌐 Please select your language / अपनी भाषा चुनें:",
    [
      {
        id: "lang_hi",
        title: "🇮🇳 हिंदी"
      },
      {
        id: "lang_en",
        title: "🇬🇧 English"
      },
      {
        id: "lang_hinglish",
        title: "😎 Hinglish"
      }
    ]
  );
}

// ===============================
// MAIN MENU
// ===============================

async function sendMainMenu(to) {

  const language = users[to]?.language || "hinglish";

  let text = "";

  if (language === "hi") {

    text =
`👋 *जनसेवक में आपका स्वागत है!*

मैं आपको सरकारी योजनाओं और सार्वजनिक सेवाओं की जानकारी प्राप्त करने में मदद कर सकता हूँ।

नीचे विकल्प चुनें 👇`;

  } else if (language === "en") {

    text =
`👋 *Welcome to JanSevak!*

I can help you find information about government schemes and public services.

Choose an option below 👇`;

  } else {

    text =
`👋 *JanSevak mein aapka swagat hai!*

Main aapko government schemes aur public services ki information dhoondhne mein help kar sakta hoon.

Neeche option choose karein 👇`;
  }

  await sendButtonMessage(
    to,
    text,
    [
      {
        id: "menu_schemes",
        title: "📋 Schemes"
      },
      {
        id: "change_language",
        title: "🌐 Language"
      },
      {
        id: "main_menu",
        title: "🏠 Home"
      }
    ]
  );
}

// ===============================
// GET SCHEME DATA
// ===============================

async function getSchemeData() {

  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;

  const response = await fetch(url);

  const text = await response.text();

  const json =
    JSON.parse(
      text.substring(47).slice(0, -2)
    );

  const rows = json.table.rows;

  const schemes = [];

  rows.forEach((row) => {

    const id = row.c[0]?.v;

    // Ignore empty/header rows
    if (
      !id ||
      String(id).toLowerCase() === "id"
    ) {
      return;
    }

    schemes.push({
      id: String(id).trim(),

      name:
        row.c[1]?.v ||
        "No Name",

      category:
        row.c[2]?.v ||
        "Not Available",

      who:
        row.c[3]?.v ||
        "Not Available",

      benefit:
        row.c[4]?.v ||
        "Not Available",

      source:
        row.c[5]?.v ||
        "Not Available"
    });

  });

  return schemes;
}

// ===============================
// SCHEME MENU
// ===============================

async function sendSchemeMenu(to) {

  const schemes = await getSchemeData();

  const language =
    users[to]?.language || "hinglish";

  let page =
    users[to]?.page || 0;

  const perPage = 3;

  const totalPages =
    Math.ceil(schemes.length / perPage);

  if (page >= totalPages) {
    page = totalPages - 1;
    users[to].page = page;
  }

  const start =
    page * perPage;

  const current =
    schemes.slice(
      start,
      start + perPage
    );

  let text = "";

  if (language === "hi") {

    text =
`📋 *सरकारी योजनाएँ*

नीचे योजना चुनें 👇

📄 पेज ${page + 1} / ${totalPages}`;

  } else if (language === "en") {

    text =
`📋 *Government Schemes*

Choose a scheme below 👇

📄 Page ${page + 1} / ${totalPages}`;

  } else {

    text =
`📋 *Government Schemes*

Neeche scheme choose karein 👇

📄 Page ${page + 1} / ${totalPages}`;

  }

  const buttons = [];

  current.forEach((scheme) => {

    buttons.push({
      id: `scheme_${scheme.id}`,
      title: scheme.id
    });

  });

  // If no schemes
  if (buttons.length === 0) {

    await sendTextMessage(
      to,
      "❌ Koi scheme available nahi hai."
    );

    return;
  }

  await sendButtonMessage(
    to,
    text,
    buttons
  );

  // Navigation
  if (totalPages > 1) {

    let navText = "";

    if (language === "hi") {
      navText = "📄 अगला पेज देखने के लिए *NEXT* लिखें।";
    } else if (language === "en") {
      navText = "📄 Type *NEXT* to see the next page.";
    } else {
      navText = "📄 Next page ke liye *NEXT* likhein.";
    }

    await sendTextMessage(
      to,
      navText
    );
  }
}

// ===============================
// SCHEME DETAILS
// ===============================

async function sendSchemeDetails(to, scheme) {

  const language =
    users[to]?.language || "hinglish";

  let text = "";

  if (language === "hi") {

    text =
`📋 *${scheme.name}*

🆔 ID: ${scheme.id}

📂 *श्रेणी:*
${scheme.category}

👥 *किसके लिए:*
${scheme.who}

💰 *मुख्य लाभ / उद्देश्य:*
${scheme.benefit}

🔗 *आधिकारिक स्रोत:*
${scheme.source}`;

  } else if (language === "en") {

    text =
`📋 *${scheme.name}*

🆔 ID: ${scheme.id}

📂 *Category:*
${scheme.category}

👥 *Who is it for:*
${scheme.who}

💰 *Main Benefit / Purpose:*
${scheme.benefit}

🔗 *Official Source:*
${scheme.source}`;

  } else {

    text =
`📋 *${scheme.name}*

🆔 ID: ${scheme.id}

📂 *Category:*
${scheme.category}

👥 *Kiske liye hai:*
${scheme.who}

💰 *Main Benefit / Purpose:*
${scheme.benefit}

🔗 *Official Source:*
${scheme.source}`;

  }

  await sendButtonMessage(
    to,
    text,
    [
      {
        id: "menu_schemes",
        title: "📋 Schemes"
      },
      {
        id: "change_language",
        title: "🌐 Language"
      },
      {
        id: "main_menu",
        title: "🏠 Home"
      }
    ]
  );
}

// ===============================
// SEND BUTTON MESSAGE
// ===============================

async function sendButtonMessage(
  to,
  body,
  buttons
) {

  const url =
    `https://graph.facebook.com/v26.0/${PHONE_NUMBER_ID}/messages`;

  const response =
    await fetch(url, {

      method: "POST",

      headers: {
        Authorization:
          `Bearer ${WHATSAPP_TOKEN}`,

        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({

        messaging_product:
          "whatsapp",

        to,

        type: "interactive",

        interactive: {

          type: "button",

          body: {
            text: body
          },

          action: {

            buttons:
              buttons
                .slice(0, 3)
                .map(button => ({
                  type: "reply",

                  reply: {
                    id: button.id,

                    title:
                      button.title.substring(
                        0,
                        20
                      )
                  }
                }))
          }
        }
      })
    });

  const data =
    await response.json();

  console.log(
    "WhatsApp Button Response:",
    data
  );
}

// ===============================
// SEND TEXT MESSAGE
// ===============================

async function sendTextMessage(
  to,
  body
) {

  const url =
    `https://graph.facebook.com/v26.0/${PHONE_NUMBER_ID}/messages`;

  const response =
    await fetch(url, {

      method: "POST",

      headers: {

        Authorization:
          `Bearer ${WHATSAPP_TOKEN}`,

        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({

        messaging_product:
          "whatsapp",

        to,

        type: "text",

        text: {
          body
        }
      })
    });

  const data =
    await response.json();

  console.log(
    "WhatsApp API response:",
    data
  );
}

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {

  res.send(
    "JanSevak WhatsApp Bot is running!"
  );

});

// ===============================
// START SERVER
// ===============================

app.listen(
  PORT,
  () => {

    console.log(
      `JanSevak server running on port ${PORT}`
    );

  }
);
