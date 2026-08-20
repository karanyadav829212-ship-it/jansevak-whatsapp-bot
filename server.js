const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// =====================================================
// GOOGLE SHEET
// =====================================================

const SHEET_ID = "1GeXblMObkNM-KDmMhQPY4ZA8Gv180L_eqb7aNteDu88";
const SHEET_NAME = "Sheet1";

// =====================================================
// USER SESSION
// =====================================================

// Temporary memory for users
const users = {};

// =====================================================
// WEBHOOK VERIFICATION
// =====================================================

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// =====================================================
// RECEIVE WHATSAPP MESSAGES
// =====================================================

app.post("/webhook", async (req, res) => {
  console.log(
    "WhatsApp webhook:",
    JSON.stringify(req.body, null, 2)
  );

  try {
    const message =
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;

    // Create user session if not exists
    if (!users[from]) {
      users[from] = {
        language: "hinglish",
        page: 0
      };
    }

    // =================================================
    // TEXT MESSAGE
    // =================================================

    if (message.type === "text") {

      const text =
        message.text?.body?.trim() || "";

      await handleTextMessage(from, text);

      return res.sendStatus(200);
    }

    // =================================================
    // INTERACTIVE MESSAGE
    // =================================================

    if (message.type === "interactive") {

      const interactive = message.interactive;

      // Button clicked
      if (interactive?.type === "button_reply") {

        const buttonId =
          interactive.button_reply?.id;

        await handleButton(from, buttonId);

        return res.sendStatus(200);
      }

      // List item selected
      if (interactive?.type === "list_reply") {

        const listId =
          interactive.list_reply?.id;

        await handleListSelection(from, listId);

        return res.sendStatus(200);
      }
    }

    return res.sendStatus(200);

  } catch (error) {

    console.error(
      "Webhook error:",
      error
    );

    return res.sendStatus(500);
  }
});

// =====================================================
// TEXT HANDLER
// =====================================================

async function handleTextMessage(from, originalText) {

  const text =
    originalText.trim().toLowerCase();

  // -----------------------------------------------
  // GREETING
  // -----------------------------------------------

  if (
    text === "hi" ||
    text === "hello" ||
    text === "hey" ||
    text === "namaste" ||
    text === "start" ||
    text === "/start"
  ) {

    await sendLanguageMenu(from);

    return;
  }

  // -----------------------------------------------
  // LANGUAGE BY TEXT
  // -----------------------------------------------

  if (
    text === "hindi" ||
    text === "हिंदी"
  ) {

    setLanguage(from, "hi");

    await sendMainMenu(from);

    return;
  }

  if (text === "english") {

    setLanguage(from, "en");

    await sendMainMenu(from);

    return;
  }

  if (text === "hinglish") {

    setLanguage(from, "hinglish");

    await sendMainMenu(from);

    return;
  }

  // -----------------------------------------------
  // NEXT
  // -----------------------------------------------

  if (
    text === "next" ||
    text === "अगला"
  ) {

    users[from].page++;

    await sendSchemeList(from);

    return;
  }

  // -----------------------------------------------
  // BACK
  // -----------------------------------------------

  if (
    text === "back" ||
    text === "पीछे"
  ) {

    users[from].page =
      Math.max(0, users[from].page - 1);

    await sendSchemeList(from);

    return;
  }

  // -----------------------------------------------
  // HOME
  // -----------------------------------------------

  if (
    text === "home" ||
    text === "menu" ||
    text === "main menu"
  ) {

    await sendMainMenu(from);

    return;
  }

  // -----------------------------------------------
  // DIRECT SCHEME ID
  // Example: JH-001
  // -----------------------------------------------

  if (/^jh-\d+$/i.test(text)) {

    const schemes =
      await getSchemes();

    const scheme =
      schemes.find(
        item =>
          item.id.toLowerCase() ===
          text.toLowerCase()
      );

    if (scheme) {

      await sendSchemeDetails(
        from,
        scheme
      );

    } else {

      await sendTextMessage(
        from,
        getText(
          from,
          "schemeNotFound"
        )
      );
    }

    return;
  }

  // -----------------------------------------------
  // NUMBER SELECTION
  // -----------------------------------------------

  if (/^\d+$/.test(text)) {

    const number =
      parseInt(text, 10);

    const schemes =
      await getSchemes();

    if (
      number >= 1 &&
      number <= schemes.length
    ) {

      await sendSchemeDetails(
        from,
        schemes[number - 1]
      );

    } else {

      await sendTextMessage(
        from,
        getText(
          from,
          "invalidOption"
        )
      );
    }

    return;
  }

  // -----------------------------------------------
  // UNKNOWN MESSAGE
  // -----------------------------------------------

  await sendTextMessage(
    from,
    getText(
      from,
      "unknown"
    )
  );

  await sendMainMenu(from);
}

// =====================================================
// BUTTON HANDLER
// =====================================================

async function handleButton(
  from,
  buttonId
) {

  // -----------------------------------------------
  // LANGUAGE
  // -----------------------------------------------

  if (buttonId === "language_hindi") {

    setLanguage(from, "hi");

    await sendMainMenu(from);

    return;
  }

  if (buttonId === "language_english") {

    setLanguage(from, "en");

    await sendMainMenu(from);

    return;
  }

  if (buttonId === "language_hinglish") {

    setLanguage(from, "hinglish");

    await sendMainMenu(from);

    return;
  }

  // -----------------------------------------------
  // MAIN MENU
  // -----------------------------------------------

  if (buttonId === "menu_schemes") {

    users[from].page = 0;

    await sendSchemeList(from);

    return;
  }

  if (buttonId === "menu_language") {

    await sendLanguageMenu(from);

    return;
  }

  if (buttonId === "menu_home") {

    await sendMainMenu(from);

    return;
  }

  // -----------------------------------------------
  // SCHEME MENU
  // -----------------------------------------------

  if (buttonId === "schemes_next") {

    users[from].page++;

    await sendSchemeList(from);

    return;
  }

  if (buttonId === "schemes_previous") {

    users[from].page =
      Math.max(
        0,
        users[from].page - 1
      );

    await sendSchemeList(from);

    return;
  }

  // -----------------------------------------------
  // DETAILS BACK
  // -----------------------------------------------

  if (buttonId === "details_back") {

    await sendSchemeList(from);

    return;
  }

  // -----------------------------------------------
  // HOME
  // -----------------------------------------------

  if (buttonId === "details_home") {

    await sendMainMenu(from);

    return;
  }

  // -----------------------------------------------
  // LANGUAGE
  // -----------------------------------------------

  if (buttonId === "details_language") {

    await sendLanguageMenu(from);

    return;
  }
}

// =====================================================
// LIST SELECTION HANDLER
// =====================================================

async function handleListSelection(
  from,
  listId
) {

  // Scheme selected
  if (listId.startsWith("scheme_")) {

    const schemeId =
      listId.replace(
        "scheme_",
        ""
      );

    const schemes =
      await getSchemes();

    const scheme =
      schemes.find(
        item =>
          item.id === schemeId
      );

    if (scheme) {

      await sendSchemeDetails(
        from,
        scheme
      );

    } else {

      await sendTextMessage(
        from,
        getText(
          from,
          "schemeNotFound"
        )
      );
    }

    return;
  }

  // Navigation
  if (listId === "scheme_next") {

    users[from].page++;

    await sendSchemeList(from);

    return;
  }

  if (listId === "scheme_previous") {

    users[from].page =
      Math.max(
        0,
        users[from].page - 1
      );

    await sendSchemeList(from);

    return;
  }
}

// =====================================================
// LANGUAGE MEMORY
// =====================================================

function setLanguage(
  from,
  language
) {

  if (!users[from]) {

    users[from] = {
      language,
      page: 0
    };

  } else {

    users[from].language =
      language;
  }
}

// =====================================================
// LANGUAGE MENU
// =====================================================

async function sendLanguageMenu(to) {

  await sendButtonMessage(
    to,

`👋 *Welcome to JanSevak!*

🌐 Please select your language
🌐 अपनी भाषा चुनें

👇 Language choose karein:`,
    [
      {
        id: "language_hindi",
        title: "🇮🇳 हिंदी"
      },
      {
        id: "language_english",
        title: "🇬🇧 English"
      },
      {
        id: "language_hinglish",
        title: "😎 Hinglish"
      }
    ]
  );
}

// =====================================================
// MAIN MENU
// =====================================================

async function sendMainMenu(to) {

  const language =
    users[to]?.language ||
    "hinglish";

  let message = "";

  if (language === "hi") {

    message =
`👋 *जनसेवक में आपका स्वागत है!*

मैं आपको सरकारी योजनाओं और सार्वजनिक सेवाओं की जानकारी प्राप्त करने में मदद कर सकता हूँ।

👇 नीचे से विकल्प चुनें:`;

  } else if (language === "en") {

    message =
`👋 *Welcome to JanSevak!*

I can help you find information about government schemes and public services.

👇 Choose an option below:`;

  } else {

    message =
`👋 *JanSevak mein aapka swagat hai!*

Main aapko government schemes aur public services ki information dhoondhne mein help kar sakta hoon.

👇 Neeche se option choose karein:`;
  }

  await sendButtonMessage(
    to,
    message,
    [
      {
        id: "menu_schemes",
        title: "📋 Schemes"
      },
      {
        id: "menu_language",
        title: "🌐 Language"
      },
      {
        id: "menu_home",
        title: "🏠 Home"
      }
    ]
  );
}

// =====================================================
// GOOGLE SHEET DATA
// =====================================================

async function getSchemes() {

  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;

  const response =
    await fetch(url);

  if (!response.ok) {

    throw new Error(
      `Google Sheet HTTP error: ${response.status}`
    );
  }

  const text =
    await response.text();

  const json =
    JSON.parse(
      text.substring(47).slice(0, -2)
    );

  const rows =
    json.table?.rows || [];

  const schemes = [];

  rows.forEach((row) => {

    const id =
      row.c?.[0]?.v;

    const name =
      row.c?.[1]?.v;

    // Ignore empty rows
    if (!id || !name) {
      return;
    }

    // Ignore header row
    if (
      String(id)
        .trim()
        .toLowerCase() === "id"
    ) {
      return;
    }

    schemes.push({

      id:
        String(id).trim(),

      name:
        String(name).trim(),

      category:
        row.c?.[2]?.v
          ? String(row.c[2].v).trim()
          : "Not Available",

      who:
        row.c?.[3]?.v
          ? String(row.c[3].v).trim()
          : "Not Available",

      benefit:
        row.c?.[4]?.v
          ? String(row.c[4].v).trim()
          : "Not Available",

      source:
        row.c?.[5]?.v
          ? String(row.c[5].v).trim()
          : "Not Available"
    });

  });

  return schemes;
}

// =====================================================
// SCHEME LIST
// =====================================================

async function sendSchemeList(to) {

  const schemes =
    await getSchemes();

  if (!schemes.length) {

    await sendTextMessage(
      to,
      getText(
        to,
        "noSchemes"
      )
    );

    return;
  }

  const language =
    users[to]?.language ||
    "hinglish";

  const perPage = 10;

  const totalPages =
    Math.ceil(
      schemes.length / perPage
    );

  let page =
    users[to]?.page || 0;

  if (page < 0) {
    page = 0;
  }

  if (page >= totalPages) {
    page = totalPages - 1;
  }

  users[to].page = page;

  const start =
    page * perPage;

  const currentSchemes =
    schemes.slice(
      start,
      start + perPage
    );

  let body = "";

  if (language === "hi") {

    body =
`📋 *सरकारी योजनाएँ*

कृपया अपनी योजना चुनें 👇

📄 पेज ${page + 1} / ${totalPages}`;

  } else if (language === "en") {

    body =
`📋 *Government Schemes*

Please select a scheme 👇

📄 Page ${page + 1} / ${totalPages}`;

  } else {

    body =
`📋 *Government Schemes*

Apni scheme select karein 👇

📄 Page ${page + 1} / ${totalPages}`;
  }

  // Create list rows
  const rows =
    currentSchemes.map(
      (scheme) => ({

        id:
          `scheme_${scheme.id}`,

        title:
          `${scheme.id} - ${scheme.name}`
            .substring(0, 24),

        description:
          `${scheme.category}`
            .substring(0, 72)
      })
    );

  // Navigation rows
  if (page > 0) {

    rows.push({

      id:
        "scheme_previous",

      title:
        language === "hi"
          ? "⬅️ पिछला पेज"
          : language === "en"
          ? "⬅️ Previous Page"
          : "⬅️ Pichhla Page",

      description:
        language === "hi"
          ? "पिछली योजनाएँ देखें"
          : language === "en"
          ? "View previous schemes"
          : "Pichhli schemes dekhein"
    });
  }

  if (page < totalPages - 1) {

    rows.push({

      id:
        "scheme_next",

      title:
        language === "hi"
          ? "➡️ अगला पेज"
          : language === "en"
          ? "➡️ Next Page"
          : "➡️ Agla Page",

      description:
        language === "hi"
          ? "अगली योजनाएँ देखें"
          : language === "en"
          ? "View more schemes"
          : "Agli schemes dekhein"
    });
  }

  await sendListMessage(
    to,
    body,
    language === "hi"
      ? "योजना चुनें"
      : language === "en"
      ? "Select Scheme"
      : "Scheme Choose Karein",
    rows
  );
}

// =====================================================
// SCHEME DETAILS
// =====================================================

async function sendSchemeDetails(
  to,
  scheme
) {

  const language =
    users[to]?.language ||
    "hinglish";

  let message = "";

  if (language === "hi") {

    message =
`📋 *${scheme.name}*

🆔 *ID:* ${scheme.id}

📂 *श्रेणी:*
${scheme.category}

👥 *किसके लिए है:*
${scheme.who}

💰 *मुख्य लाभ / उद्देश्य:*
${scheme.benefit}

🔗 *आधिकारिक स्रोत:*
${scheme.source}`;

  } else if (language === "en") {

    message =
`📋 *${scheme.name}*

🆔 *ID:* ${scheme.id}

📂 *Category:*
${scheme.category}

👥 *Who is it for:*
${scheme.who}

💰 *Main Benefit / Purpose:*
${scheme.benefit}

🔗 *Official Source:*
${scheme.source}`;

  } else {

    message =
`📋 *${scheme.name}*

🆔 *ID:* ${scheme.id}

📂 *Category:*
${scheme.category}

👥 *Kiske liye hai:*
${scheme.who}

💰 *Main Benefit / Purpose:*
${scheme.benefit}

🔗 *Official Source:*
${scheme.source}`;
  }

  await sendTextMessage(
    to,
    message
  );

  await sendButtonMessage(
    to,
    language === "hi"
      ? "👇 आगे क्या करना चाहते हैं?"
      : language === "en"
      ? "👇 What would you like to do next?"
      : "👇 Ab aap kya karna chahte hain?",

    [
      {
        id: "details_back",
        title:
          language === "hi"
            ? "⬅️ योजनाएँ"
            : language === "en"
            ? "⬅️ Schemes"
            : "⬅️ Schemes"
      },
      {
        id: "details_language",
        title: "🌐 Language"
      },
      {
        id: "details_home",
        title: "🏠 Home"
      }
    ]
  );
}

// =====================================================
// SEND WHATSAPP BUTTON MESSAGE
// =====================================================

async function sendButtonMessage(
  to,
  body,
  buttons
) {

  const url =
    `https://graph.facebook.com/v26.0/${PHONE_NUMBER_ID}/messages`;

  const response =
    await fetch(
      url,
      {
        method: "POST",

        headers: {

          Authorization:
            `Bearer ${WHATSAPP_TOKEN}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({

            messaging_product:
              "whatsapp",

            to,

            type:
              "interactive",

            interactive: {

              type:
                "button",

              body: {
                text:
                  body.substring(
                    0,
                    1024
                  )
              },

              action: {

                buttons:
                  buttons
                    .slice(0, 3)
                    .map(
                      button => ({

                        type:
                          "reply",

                        reply: {

                          id:
                            button.id,

                          title:
                            button.title
                              .substring(
                                0,
                                20
                              )
                        }
                      })
                    )
              }
            }
          })
      }
    );

  const data =
    await response.json();

  console.log(
    "Button API response:",
    data
  );
}

// =====================================================
// SEND WHATSAPP LIST MESSAGE
// =====================================================

async function sendListMessage(
  to,
  body,
  buttonText,
  rows
) {

  const url =
    `https://graph.facebook.com/v26.0/${PHONE_NUMBER_ID}/messages`;

  const response =
    await fetch(
      url,
      {
        method: "POST",

        headers: {

          Authorization:
            `Bearer ${WHATSAPP_TOKEN}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({

            messaging_product:
              "whatsapp",

            to,

            type:
              "interactive",

            interactive: {

              type:
                "list",

              body: {

                text:
                  body.substring(
                    0,
                    1024
                  )
              },

              action: {

                button:
                  buttonText
                    .substring(
                      0,
                      20
                    ),

                sections: [

                  {

                    title:
                      "JanSevak",

                    rows:
                      rows
                        .slice(0, 10)
                  }

                ]
              }
            }
          })
      }
    );

  const data =
    await response.json();

  console.log(
    "List API response:",
    data
  );
}

// =====================================================
// SEND TEXT MESSAGE
// =====================================================

async function sendTextMessage(
  to,
  body
) {

  const url =
    `https://graph.facebook.com/v26.0/${PHONE_NUMBER_ID}/messages`;

  const response =
    await fetch(
      url,
      {
        method: "POST",

        headers: {

          Authorization:
            `Bearer ${WHATSAPP_TOKEN}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({

            messaging_product:
              "whatsapp",

            to,

            type:
              "text",

            text: {
              body
            }
          })
      }
    );

  const data =
    await response.json();

  console.log(
    "Text API response:",
    data
  );
}

// =====================================================
// MULTI-LANGUAGE TEXT
// =====================================================

function getText(
  from,
  key
) {

  const language =
    users[from]?.language ||
    "hinglish";

  const texts = {

    schemeNotFound: {

      hi:
        "❌ माफ कीजिए, यह योजना नहीं मिली।\n\nउदाहरण: JH-001",

      en:
        "❌ Sorry, this scheme was not found.\n\nExample: JH-001",

      hinglish:
        "❌ Sorry, ye scheme nahi mili.\n\nExample: JH-001"
    },

    invalidOption: {

      hi:
        "🙏 कृपया उपलब्ध विकल्प चुनें।",

      en:
        "🙏 Please choose a valid option.",

      hinglish:
        "🙏 Kripya available option choose karein."
    },

    unknown: {

      hi:
        "🙏 मैं आपका संदेश समझ नहीं पाया। कृपया नीचे दिए गए विकल्पों में से चुनें।",

      en:
        "🙏 I couldn't understand your message. Please choose an option from the menu.",

      hinglish:
        "🙏 Main aapka message samajh nahi paya. Kripya menu se option choose karein."
    },

    noSchemes: {

      hi:
        "❌ अभी कोई सरकारी योजना उपलब्ध नहीं है।",

      en:
        "❌ No government schemes are currently available.",

      hinglish:
        "❌ Abhi koi government scheme available nahi hai."
    }

  };

  return (
    texts[key]?.[language] ||
    texts[key]?.hinglish ||
    "Something went wrong."
  );
}

// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
  "/health",
  (req, res) => {

    res.status(200).json({

      status:
        "ok",

      service:
        "JanSevak WhatsApp Bot",

      time:
        new Date().toISOString()

    });

  }
);

// =====================================================
// HOME
// =====================================================

app.get(
  "/",
  (req, res) => {

    res.send(
      "🇮🇳 JanSevak WhatsApp Bot is running!"
    );

  }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  () => {

    console.log(
      `JanSevak server running on port ${PORT}`
    );

  }
);
