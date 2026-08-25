from pathlib import Path

code = r'''const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// =====================================================
// ENVIRONMENT VARIABLES
// =====================================================

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GRAPH_API_VERSION =
  process.env.GRAPH_API_VERSION || "v26.0";

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-2.5-flash";

const ai = GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  : null;

// =====================================================
// GOOGLE SHEET
// =====================================================

const SHEET_ID =
  "1GeXblMObkNM-KDmMhQPY4ZA8Gv180L_eqb7aNteDu88";

const SHEET_NAME = "Sheet1";

// =====================================================
// USER SESSIONS
// mode:
//   language = language selection
//   menu     = main menu
//   ai       = AI Help / scheme conversation
//   apply    = Apply Guide conversation
// =====================================================

const users = {};

// =====================================================
// SESSION CREATION
// =====================================================

function ensureUser(from) {
  if (!users[from]) {
    users[from] = {
      language: null,
      mode: "language",
      lastQuestion: "",
      lastAnswer: "",
      page: 0
    };
  }

  return users[from];
}

function setLanguage(from, language) {
  const user = ensureUser(from);

  user.language = language;
  user.mode = "menu";
  user.lastQuestion = "";
  user.lastAnswer = "";
  user.page = 0;
}

// =====================================================
// WEBHOOK VERIFICATION
// =====================================================

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === VERIFY_TOKEN
  ) {
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

  // Respond to Meta immediately.
  res.sendStatus(200);

  try {
    const message =
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return;

    const from = message.from;
    ensureUser(from);

    // ---------------- TEXT ----------------

    if (message.type === "text") {
      const text =
        message.text?.body?.trim() || "";

      await handleTextMessage(from, text);
      return;
    }

    // ---------------- INTERACTIVE ----------------

    if (message.type === "interactive") {
      const interactive = message.interactive;

      if (interactive?.type === "button_reply") {
        const buttonId =
          interactive.button_reply?.id;

        await handleButton(from, buttonId);
        return;
      }

      if (interactive?.type === "list_reply") {
        const listId =
          interactive.list_reply?.id;

        await handleListSelection(from, listId);
        return;
      }
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
  }
});

// =====================================================
// TEXT HANDLER
// =====================================================

async function handleTextMessage(from, originalText) {
  const user = ensureUser(from);

  const rawText =
    String(originalText || "").trim();

  const text = rawText.toLowerCase();

  if (!rawText) return;

  // ===================================================
  // THANK YOU
  // ===================================================

  if (
    isThankYou(text)
  ) {
    await sendTextMessage(
      from,
      getText(from, "thankYou")
    );
    return;
  }

  // ===================================================
  // GREETING / START
  // ===================================================

  if (isGreeting(text)) {
    // A new greeting always starts the language flow.
    user.mode = "language";
    user.lastQuestion = "";
    user.lastAnswer = "";

    await sendLanguageMenu(from);
    return;
  }

  // ===================================================
  // LANGUAGE TEXT SELECTION
  // ===================================================

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

  // ===================================================
  // BACK / HOME TEXT
  // ===================================================

  if (isBackCommand(text)) {
    await goToMainMenu(from);
    return;
  }

  // ===================================================
  // IF NO LANGUAGE HAS BEEN CHOSEN
  // ===================================================

  if (!user.language) {
    await sendLanguageMenu(from);
    return;
  }

  // ===================================================
  // AI MODE
  // ===================================================

  if (user.mode === "ai") {
    await processAiHelp(from, rawText);
    return;
  }

  // ===================================================
  // APPLY GUIDE MODE
  // ===================================================

  if (user.mode === "apply") {
    await processApplyGuide(from, rawText);
    return;
  }

  // ===================================================
  // MENU MODE
  // ===================================================

  await sendTextMessage(
    from,
    getText(from, "chooseMenu")
  );

  await sendMainMenu(from);
}

// =====================================================
// BUTTON HANDLER
// =====================================================

async function handleButton(from, buttonId) {
  ensureUser(from);

  // ---------------- LANGUAGE ----------------

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

  // ---------------- MAIN MENU ----------------

  if (buttonId === "menu_language") {
    users[from].mode = "language";
    await sendLanguageMenu(from);
    return;
  }

  if (buttonId === "menu_ai") {
    users[from].mode = "ai";
    users[from].lastQuestion = "";
    users[from].lastAnswer = "";

    await sendTextWithBack(
      from,
      getText(from, "aiStart")
    );
    return;
  }

  if (buttonId === "menu_apply") {
    users[from].mode = "apply";
    users[from].lastQuestion = "";
    users[from].lastAnswer = "";

    await sendTextWithBack(
      from,
      getText(from, "applyStart")
    );
    return;
  }

  // ---------------- BACK ----------------

  if (buttonId === "back_main") {
    await goToMainMenu(from);
    return;
  }
}

// =====================================================
// LIST HANDLER
// Kept only for compatibility with old messages.
// New main menu does NOT use a list.
// =====================================================

async function handleListSelection(from, listId) {
  if (!listId) return;

  if (listId.startsWith("scheme_")) {
    const schemeId =
      listId.replace("scheme_", "");

    const schemes = await getSchemes();

    const scheme = schemes.find(
      item =>
        item.id.toLowerCase() ===
        schemeId.toLowerCase()
    );

    if (scheme) {
      await sendSchemeAnswerWithBack(
        from,
        formatSchemeDetails(from, scheme)
      );
    } else {
      await sendTextWithBack(
        from,
        getText(from, "schemeNotFound")
      );
    }
  }
}

// =====================================================
// MAIN MENU
// EXACTLY 3 BUTTONS
// =====================================================

async function sendMainMenu(to) {
  const language =
    users[to]?.language || "hinglish";

  users[to].mode = "menu";

  const message =
    getText(to, "mainMenu");

  await sendButtonMessage(
    to,
    message,
    [
      {
        id: "menu_language",
        title:
          language === "hi"
            ? "🌐 भाषा"
            : language === "en"
            ? "🌐 Language"
            : "🌐 Language"
      },
      {
        id: "menu_ai",
        title: "🤖 AI Help"
      },
      {
        id: "menu_apply",
        title:
          language === "hi"
            ? "📝 आवेदन सहायता"
            : language === "en"
            ? "📝 Apply Guide"
            : "📝 Apply Guide"
      }
    ]
  );
}

// =====================================================
// LANGUAGE MENU
// EXACTLY 3 BUTTONS
// =====================================================

async function sendLanguageMenu(to) {
  ensureUser(to);

  users[to].mode = "language";

  await sendButtonMessage(
    to,

    `👋 *Welcome to JanSevak!*

🌐 Please select your language
👇 अपनी भाषा चुनें`,

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
// GO BACK TO MAIN MENU
// =====================================================

async function goToMainMenu(from) {
  const user = ensureUser(from);

  user.mode = "menu";
  user.lastQuestion = "";
  user.lastAnswer = "";
  user.page = 0;

  await sendMainMenu(from);
}

// =====================================================
// AI HELP
// ONLY GOVERNMENT SCHEMES / CITIZEN SCHEME HELP
// =====================================================

async function processAiHelp(from, question) {
  const user = ensureUser(from);

  // Do not repeatedly send the same answer.
  if (
    normalizeForCompare(question) ===
      normalizeForCompare(user.lastQuestion) &&
    user.lastAnswer
  ) {
    return;
  }

  const answer = await askGemini(
    from,
    question,
    "ai"
  );

  // If Gemini returns the exact same answer,
  // do not send it again.
  if (
    normalizeForCompare(answer) ===
      normalizeForCompare(user.lastAnswer)
  ) {
    return;
  }

  user.lastQuestion = question;
  user.lastAnswer = answer;

  await sendTextWithBack(
    from,
    `🤖 *JanSevak AI Help*

${answer}`
  );
}

// =====================================================
// APPLY GUIDE
// ONLY APPLICATION / APPLY PROCESS
// =====================================================

async function processApplyGuide(from, question) {
  const user = ensureUser(from);

  if (
    normalizeForCompare(question) ===
      normalizeForCompare(user.lastQuestion) &&
    user.lastAnswer
  ) {
    return;
  }

  const answer = await askGemini(
    from,
    question,
    "apply"
  );

  if (
    normalizeForCompare(answer) ===
      normalizeForCompare(user.lastAnswer)
  ) {
    return;
  }

  user.lastQuestion = question;
  user.lastAnswer = answer;

  await sendTextWithBack(
    from,
    `📝 *JanSevak Apply Guide*

${answer}`
  );
}

// =====================================================
// GEMINI
// =====================================================

async function askGemini(
  from,
  question,
  mode
) {
  try {
    if (!ai) {
      return getText(
        from,
        "aiUnavailable"
      );
    }

    const language =
      users[from]?.language ||
      "hinglish";

    const languageInstruction =
      language === "hi"
        ? "Answer only in simple Hindi using Devanagari script."
        : language === "en"
        ? "Answer only in simple English."
        : "Answer only in simple Hinglish using Roman Hindi.";

    let schemes = [];

    try {
      schemes = await getSchemes();
    } catch (error) {
      console.error(
        "Google Sheet error:",
        error
      );
    }

    const schemeContext =
      schemes
        .map(
          scheme =>
`ID: ${scheme.id}
Name: ${scheme.name}
Category: ${scheme.category}
Who is it for: ${scheme.who}
Benefit: ${scheme.benefit}
Official Source: ${scheme.source}`
        )
        .join("\n\n");

    let modeRules = "";

    if (mode === "ai") {
      modeRules = `
MODE: AI HELP

You are helping the citizen ONLY with government schemes and
scheme-related citizen support.

Allowed topics:
- Which government scheme may be suitable for the citizen
- Scheme eligibility
- Age/category based scheme questions
- Benefits of schemes
- Available schemes
- Who a scheme is for
- Basic scheme-related guidance

IMPORTANT:
- If the user gives age, gender, occupation, income, location,
  student status or another personal detail, use it only to
  identify potentially relevant schemes.
- Use the provided Google Sheet data first.
- If the sheet does not contain enough information, clearly say
  that the citizen should verify the detail from the official
  government department/portal.
- Do NOT answer unrelated general questions such as jokes,
  sports, movies, coding, school homework, politics, etc.
- For an unrelated question, politely say that AI Help is only
  for government schemes and scheme-related help.
- Do not invent schemes, benefits, eligibility, amounts or rules.
`;
    } else {
      modeRules = `
MODE: APPLY GUIDE

You are helping the citizen ONLY with applying for government
schemes.

Allowed topics:
- How to apply for a scheme
- Where/how the application is submitted
- Basic application steps
- Application portal/process when supported by the provided data
- Application-related guidance
- What the citizen should check before applying

IMPORTANT:
- Do NOT answer unrelated questions.
- Do NOT turn an Apply Guide question into general AI chat.
- Do NOT invent an application website or process.
- If the provided sheet does not contain the application process,
  clearly tell the citizen to verify the current process on the
  official government portal/department.
`;
    }

    const prompt = `
You are "JanSevak AI", a citizen-support assistant for India.

${languageInstruction}

${modeRules}

GENERAL SAFETY / ACCURACY RULES:
1. Keep WhatsApp answers clear and reasonably short.
2. Be friendly and respectful.
3. Use useful emojis, but do not overuse them.
4. Never claim JanSevak can approve an application.
5. Never invent government schemes.
6. Never invent eligibility, amounts, documents or deadlines.
7. Never present guesses as facts.
8. Prefer the Google Sheet information below.
9. If information is missing, tell the citizen to verify it
   from the official government source.
10. Do not repeat the same answer unnecessarily.
11. Do not include a Back button in your answer. The bot adds it.

AVAILABLE JANSEVAK SCHEME DATA:

${schemeContext || "No scheme data is currently available."}

CITIZEN QUESTION:

${question}
`;

    const response =
      await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt
      });

    const answer =
      response?.text?.trim();

    if (!answer) {
      return getText(
        from,
        "aiUnavailable"
      );
    }

    return answer;
  } catch (error) {
    console.error(
      "Gemini error:",
      error?.message || error
    );

    return getText(
      from,
      "aiUnavailable"
    );
  }
}

// =====================================================
// GOOGLE SHEET
// =====================================================

async function getSchemes() {
  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Google Sheet HTTP error: ${response.status}`
    );
  }

  const text =
    await response.text();

  const start =
    text.indexOf("{");

  const end =
    text.lastIndexOf("}");

  if (
    start === -1 ||
    end === -1
  ) {
    throw new Error(
      "Invalid Google Sheet response"
    );
  }

  const json =
    JSON.parse(
      text.substring(start, end + 1)
    );

  const rows =
    json.table?.rows || [];

  const schemes = [];

  rows.forEach(row => {
    const id =
      row.c?.[0]?.v;

    const name =
      row.c?.[1]?.v;

    if (!id || !name) {
      return;
    }

    if (
      String(id)
        .trim()
        .toLowerCase() === "id"
    ) {
      return;
    }

    schemes.push({
      id: String(id).trim(),
      name: String(name).trim(),

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
// SCHEME DETAILS
// =====================================================

function formatSchemeDetails(
  from,
  scheme
) {
  const language =
    users[from]?.language ||
    "hinglish";

  if (language === "hi") {
    return `📋 *${scheme.name}*

🆔 *ID:* ${scheme.id}

📂 *श्रेणी:*
${scheme.category}

👥 *किसके लिए है:*
${scheme.who}

💰 *मुख्य लाभ / उद्देश्य:*
${scheme.benefit}

🔗 *आधिकारिक स्रोत:*
${scheme.source}`;
  }

  if (language === "en") {
    return `📋 *${scheme.name}*

🆔 *ID:* ${scheme.id}

📂 *Category:*
${scheme.category}

👥 *Who is it for:*
${scheme.who}

💰 *Main Benefit / Purpose:*
${scheme.benefit}

🔗 *Official Source:*
${scheme.source}`;
  }

  return `📋 *${scheme.name}*

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

async function sendSchemeAnswerWithBack(
  from,
  answer
) {
  await sendTextWithBack(
    from,
    answer
  );
}

// =====================================================
// SEND BUTTON MESSAGE
// WhatsApp allows MAX 3 reply buttons.
// This function always sends <= 3.
// =====================================================

async function sendButtonMessage(
  to,
  body,
  buttons
) {
  const url =
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const safeButtons =
    buttons
      .slice(0, 3)
      .map(button => ({
        type: "reply",
        reply: {
          id: String(button.id).substring(0, 256),
          title: String(button.title).substring(0, 20)
        }
      }));

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
        messaging_product: "whatsapp",
        to,
        type: "interactive",

        interactive: {
          type: "button",

          body: {
            text:
              String(body).substring(0, 1024)
          },

          action: {
            buttons: safeButtons
          }
        }
      })
    });

  const data =
    await response.json();

  if (!response.ok) {
    console.error(
      "WhatsApp Button API error:",
      data
    );
  } else {
    console.log(
      "Button API response:",
      data
    );
  }
}

// =====================================================
// ANSWER + BACK BUTTON IN THE SAME MESSAGE
// IMPORTANT:
// No separate "Back" message is sent.
// The answer itself is the body.
// The Back button is directly underneath it.
// =====================================================

async function sendTextWithBack(
  to,
  body
) {
  const language =
    users[to]?.language ||
    "hinglish";

  await sendButtonMessage(
    to,
    body,

    [
      {
        id: "back_main",
        title:
          language === "hi"
            ? "⬅️ मुख्य मेनू"
            : language === "en"
            ? "⬅️ Back"
            : "⬅️ Back"
      }
    ]
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
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

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
        messaging_product: "whatsapp",
        to,
        type: "text",

        text: {
          body: String(body)
        }
      })
    });

  const data =
    await response.json();

  if (!response.ok) {
    console.error(
      "WhatsApp Text API error:",
      data
    );
  } else {
    console.log(
      "Text API response:",
      data
    );
  }
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
    mainMenu: {
      hi:
`👋 *जनसेवक में आपका स्वागत है!*

मैं आपको सरकारी योजनाओं और आवेदन से जुड़ी जानकारी में मदद कर सकता हूँ।

👇 नीचे से विकल्प चुनें:`,

      en:
`👋 *Welcome to JanSevak!*

I can help you with government schemes and application guidance.

👇 Choose an option below:`,

      hinglish:
`👋 *JanSevak mein aapka swagat hai!*

Main aapko government schemes aur application se related information mein help kar sakta hoon.

👇 Neeche se option choose karein:`
    },

    aiStart: {
      hi:
`🤖 *AI Help*

आप सरकारी योजनाओं से जुड़ा सवाल पूछ सकते हैं।

उदाहरण:
• मेरी उम्र 15 साल है, मेरे लिए कौन-सी योजना है?
• मेरे लिए कौन-कौन सी schemes available हैं?
• इस योजना का benefit क्या है?

👇 अपना सवाल भेजें।`,

      en:
`🤖 *AI Help*

You can ask questions related to government schemes.

Examples:
• I am 15 years old. Which scheme may be suitable for me?
• What government schemes are available for me?
• What is the benefit of this scheme?

👇 Send your question.`,

      hinglish:
`🤖 *AI Help*

Aap government schemes se related questions pooch sakte hain.

Examples:
• Main 15 saal ka hoon, mere liye kaunsi scheme hai?
• Mere liye kaun-kaun si government schemes available hain?
• Is scheme ka benefit kya hai?

👇 Apna question bhejein.`
    },

    applyStart: {
      hi:
`📝 *आवेदन सहायता*

यहाँ आप केवल किसी सरकारी योजना के लिए आवेदन करने की प्रक्रिया के बारे में पूछ सकते हैं।

उदाहरण:
• इस योजना के लिए कैसे apply करें?
• आवेदन कहाँ करना है?
• आवेदन करने के steps क्या हैं?

👇 अपना सवाल भेजें।`,

      en:
`📝 *Apply Guide*

Here you can ask only about the application process for a government scheme.

Examples:
• How can I apply for this scheme?
• Where do I submit the application?
• What are the application steps?

👇 Send your question.`,

      hinglish:
`📝 *Apply Guide*

Yahan aap sirf government scheme ke application process ke baare mein pooch sakte hain.

Examples:
• Is scheme ke liye kaise apply karein?
• Application kahan karna hai?
• Apply karne ke steps kya hain?

👇 Apna question bhejein.`
    },

    chooseMenu: {
      hi:
        "🙏 कृपया पहले नीचे दिए गए विकल्पों में से एक चुनें।",

      en:
        "🙏 Please choose one of the options below first.",

      hinglish:
        "🙏 Pehle neeche diye gaye options mein se ek choose karein."
    },

    schemeNotFound: {
      hi:
        "❌ माफ कीजिए, यह योजना नहीं मिली।",

      en:
        "❌ Sorry, this scheme was not found.",

      hinglish:
        "❌ Sorry, ye scheme nahi mili."
    },

    thankYou: {
      hi:
        "🙏 धन्यवाद! JanSevak आपकी मदद के लिए हमेशा तैयार है। 🇮🇳",

      en:
        "🙏 Thank you! JanSevak is always here to help. 🇮🇳",

      hinglish:
        "🙏 Thank you! JanSevak aapki help ke liye hamesha ready hai. 🇮🇳"
    },

    aiUnavailable: {
      hi:
        "⚠️ AI सेवा अभी अस्थायी रूप से उपलब्ध नहीं है। कृपया थोड़ी देर बाद दोबारा प्रयास करें।",

      en:
        "⚠️ AI service is temporarily unavailable. Please try again later.",

      hinglish:
        "⚠️ AI service abhi temporarily available nahi hai. Thodi der baad dobara try karein."
    }
  };

  return (
    texts[key]?.[language] ||
    texts[key]?.hinglish ||
    "Something went wrong."
  );
}

// =====================================================
// HELPERS
// =====================================================

function isGreeting(text) {
  return [
    "hi",
    "hello",
    "hey",
    "hii",
    "hiii",
    "namaste",
    "namaskar",
    "start",
    "/start"
  ].includes(text);
}

function isThankYou(text) {
  return [
    "thanks",
    "thank you",
    "thankyou",
    "thx",
    "ty",
    "धन्यवाद",
    "शुक्रिया"
  ].includes(text);
}

function isBackCommand(text) {
  return [
    "back",
    "go back",
    "home",
    "menu",
    "main menu",
    "पीछे",
    "वापस",
    "मुख्य मेनू"
  ].includes(text);
}

function normalizeForCompare(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "JanSevak WhatsApp Bot",
    gemini:
      GEMINI_API_KEY
        ? "configured"
        : "missing",
    time:
      new Date().toISOString()
  });
});

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  res.send(
    "🇮🇳 JanSevak WhatsApp Bot is running!"
  );
});

// =====================================================
// START SERVER
// IMPORTANT:
// Only ONE app.listen() exists in this file.
// This prevents EADDRINUSE caused by duplicate servers.
// =====================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `JanSevak server running on port ${PORT}`
  );

  console.log(
    `Gemini AI: ${
      GEMINI_API_KEY
        ? "Configured ✅"
        : "Missing ❌"
    }`
  );

  console.log(
    `Gemini model: ${GEMINI_MODEL}`
  );
});
'''

path = Path("/mnt/data/server.js")
path.write_text(code, encoding="utf-8")
print(f"Created: {path}")
print(f"Lines: {len(code.splitlines())}")
