const express = require("express");

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

// =====================================================
// GEMINI AI
// =====================================================

const { GoogleGenAI } = require("@google/genai");

const ai = GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: GEMINI_API_KEY
    })
  : null;

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-2.5-flash";

// =====================================================
// GOOGLE SHEET
// =====================================================

const SHEET_ID =
  "1GeXblMObkNM-KDmMhQPY4ZA8Gv180L_eqb7aNteDu88";

const SHEET_NAME = "Sheet1";

// =====================================================
// USER SESSIONS
// =====================================================

const users = {};

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
    console.log("Webhook verified successfully ✅");
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
      req.body
        ?.entry?.[0]
        ?.changes?.[0]
        ?.value
        ?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;

    createUser(from);

    // =================================================
    // TEXT
    // =================================================

    if (message.type === "text") {
      const text =
        message.text?.body?.trim() || "";

      await handleTextMessage(from, text);

      return res.sendStatus(200);
    }

    // =================================================
    // BUTTON / LIST
    // =================================================

    if (message.type === "interactive") {
      const interactive = message.interactive;

      if (
        interactive?.type === "button_reply"
      ) {
        const buttonId =
          interactive.button_reply?.id;

        await handleButton(from, buttonId);

        return res.sendStatus(200);
      }

      if (
        interactive?.type === "list_reply"
      ) {
        const listId =
          interactive.list_reply?.id;

        await handleListSelection(from, listId);

        return res.sendStatus(200);
      }
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error("Webhook error:", error);
    return res.sendStatus(500);
  }
});

// =====================================================
// CREATE USER
// =====================================================

function createUser(from) {
  if (!users[from]) {
    users[from] = {
      language: null,
      mode: "language",
      page: 0,
      lastQuestion: "",
      lastAnswer: "",
      lastMessageTime: 0
    };
  }
}

// =====================================================
// TEXT HANDLER
// =====================================================

async function handleTextMessage(from, originalText) {
  createUser(from);

  const rawText =
    originalText.trim();

  const text =
    rawText.toLowerCase();

  // =================================================
  // THANK YOU / DONE
  // =================================================

  if (isThankYou(text)) {
    await sendTextMessage(
      from,
      getText(from, "thankYou")
    );

    return;
  }

  // =================================================
  // FIRST MESSAGE / GREETING
  // =================================================

  if (isGreeting(text)) {
    await sendLanguageMenu(from);
    return;
  }

  // =================================================
  // LANGUAGE COMMANDS
  // =================================================

  if (
    text === "hindi" ||
    text === "हिंदी" ||
    text === "1"
  ) {
    setLanguage(from, "hi");
    await sendMainMenu(from);
    return;
  }

  if (
    text === "english" ||
    text === "अंग्रेजी" ||
    text === "2"
  ) {
    setLanguage(from, "en");
    await sendMainMenu(from);
    return;
  }

  if (
    text === "hinglish" ||
    text === "हिंग्लिश" ||
    text === "3"
  ) {
    setLanguage(from, "hinglish");
    await sendMainMenu(from);
    return;
  }

  // =================================================
  // BACK / HOME
  // =================================================

  if (isBackCommand(text)) {
    await sendMainMenu(from);
    return;
  }

  if (isHomeCommand(text)) {
    await sendMainMenu(from);
    return;
  }

  // =================================================
  // IF LANGUAGE NOT SELECTED
  // =================================================

  if (!users[from].language) {
    await sendLanguageMenu(from);
    return;
  }

  // =================================================
  // AI MODE
  // =================================================

  if (users[from].mode === "ai") {

    await processAIQuestion(
      from,
      rawText,
      "ai"
    );

    return;
  }

  // =================================================
  // SCHEMES MODE
  // =================================================

  if (users[from].mode === "schemes") {

    // Direct scheme ID
    if (/^jh-\d+$/i.test(rawText)) {

      const schemes =
        await getSchemes();

      const scheme =
        schemes.find(
          item =>
            item.id.toLowerCase() ===
            rawText.toLowerCase()
        );

      if (scheme) {
        await sendSchemeDetails(
          from,
          scheme
        );
      } else {
        await sendBackMessage(
          from,
          getText(from, "schemeNotFound")
        );
      }

      return;
    }

    await processAIQuestion(
      from,
      rawText,
      "schemes"
    );

    return;
  }

  // =================================================
  // APPLY GUIDE MODE
  // =================================================

  if (users[from].mode === "apply") {

    await processAIQuestion(
      from,
      rawText,
      "apply"
    );

    return;
  }

  // =================================================
  // DOCUMENTS MODE
  // =================================================

  if (users[from].mode === "documents") {

    await processAIQuestion(
      from,
      rawText,
      "documents"
    );

    return;
  }

  // =================================================
  // UNKNOWN
  // =================================================

  await sendBackMessage(
    from,
    getText(from, "unknown")
  );
}

// =====================================================
// GREETING
// =====================================================

function isGreeting(text) {
  const greetings = [
    "hi",
    "hello",
    "hey",
    "hii",
    "hiii",
    "helo",
    "namaste",
    "namaskar",
    "start",
    "/start"
  ];

  return greetings.includes(text);
}

// =====================================================
// THANK YOU
// =====================================================

function isThankYou(text) {
  const words = [
    "thank you",
    "thanks",
    "thank u",
    "thankyou",
    "thx",
    "ty",
    "done",
    "done ✅",
    "ok done",
    "okay done",
    "dhanyawad",
    "धन्यवाद",
    "शुक्रिया"
  ];

  return words.includes(text);
}

// =====================================================
// BACK
// =====================================================

function isBackCommand(text) {
  const commands = [
    "back",
    "go back",
    "पीछे",
    "वापस",
    "piche",
    "wapas"
  ];

  return commands.includes(text);
}

// =====================================================
// HOME
// =====================================================

function isHomeCommand(text) {
  const commands = [
    "home",
    "menu",
    "main menu",
    "मुख्य मेनू",
    "main"
  ];

  return commands.includes(text);
}

// =====================================================
// LANGUAGE
// =====================================================

function setLanguage(from, language) {
  createUser(from);

  users[from].language = language;
  users[from].mode = "menu";
  users[from].page = 0;
  users[from].lastQuestion = "";
  users[from].lastAnswer = "";
}

// =====================================================
// LANGUAGE MENU
// =====================================================

async function sendLanguageMenu(to) {

  await sendButtonMessage(
    to,

    `👋 Welcome to JanSevak!

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
// MAIN MENU
// =====================================================

async function sendMainMenu(to) {

  createUser(to);

  users[to].mode = "menu";

  const language =
    users[to].language || "hinglish";

  let body = "";

  let rows = [];

  // =================================================
  // HINDI
  // =================================================

  if (language === "hi") {

    body =
`👋 *जनसेवक में आपका स्वागत है!*

मैं आपको सरकारी योजनाओं और आवेदन से जुड़ी जानकारी समझने में मदद कर सकता हूँ।

👇 कृपया एक विकल्प चुनें:`;

    rows = [
      {
        id: "menu_language",
        title: "🌐 भाषा",
        description: "भाषा बदलें"
      },
      {
        id: "menu_ai",
        title: "🤖 AI सहायता",
        description: "सामान्य सहायता प्राप्त करें"
      },
      {
        id: "menu_schemes",
        title: "📋 योजनाएँ",
        description: "सरकारी योजनाओं की जानकारी"
      },
      {
        id: "menu_apply",
        title: "📝 आवेदन गाइड",
        description: "आवेदन करने की प्रक्रिया"
      },
      {
        id: "menu_documents",
        title: "📄 दस्तावेज़",
        description: "योजना के दस्तावेज़ जानें"
      }
    ];
  }

  // =================================================
  // ENGLISH
  // =================================================

  else if (language === "en") {

    body =
`👋 *Welcome to JanSevak!*

I can help you understand government schemes and application-related information.

👇 Please choose an option:`;

    rows = [
      {
        id: "menu_language",
        title: "🌐 Language",
        description: "Change language"
      },
      {
        id: "menu_ai",
        title: "🤖 AI Help",
        description: "Get general assistance"
      },
      {
        id: "menu_schemes",
        title: "📋 Schemes",
        description: "Government scheme information"
      },
      {
        id: "menu_apply",
        title: "📝 Apply Guide",
        description: "Application process guidance"
      },
      {
        id: "menu_documents",
        title: "📄 Documents",
        description: "Know required documents"
      }
    ];
  }

  // =================================================
  // HINGLISH
  // =================================================

  else {

    body =
`👋 *JanSevak mein aapka swagat hai!*

Main aapko government schemes aur application se related information samajhne mein help kar sakta hoon.

👇 Ek option choose karein:`;

    rows = [
      {
        id: "menu_language",
        title: "🌐 Language",
        description: "Language change karein"
      },
      {
        id: "menu_ai",
        title: "🤖 AI Help",
        description: "General help lein"
      },
      {
        id: "menu_schemes",
        title: "📋 Schemes",
        description: "Government schemes ki information"
      },
      {
        id: "menu_apply",
        title: "📝 Apply Guide",
        description: "Application process samjhein"
      },
      {
        id: "menu_documents",
        title: "📄 Documents",
        description: "Required documents jaanen"
      }
    ];
  }

  await sendListMessage(
    to,
    body,
    language === "hi"
      ? "विकल्प चुनें"
      : language === "en"
      ? "Choose Option"
      : "Option Choose Karein",
    rows
  );
}

// =====================================================
// BUTTON HANDLER
// =====================================================

async function handleButton(from, buttonId) {

  createUser(from);

  // =================================================
  // LANGUAGE
  // =================================================

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

  // =================================================
  // BACK
  // =================================================

  if (buttonId === "back_menu") {
    await sendMainMenu(from);
    return;
  }

  // =================================================
  // AI
  // =================================================

  if (buttonId === "menu_ai") {

    users[from].mode = "ai";

    await sendBackMessage(
      from,
      getText(from, "aiStart")
    );

    return;
  }

  // =================================================
  // SCHEMES
  // =================================================

  if (buttonId === "menu_schemes") {

    users[from].mode = "schemes";
    users[from].page = 0;

    await sendSchemeList(from);

    return;
  }

  // =================================================
  // APPLY
  // =================================================

  if (buttonId === "menu_apply") {

    users[from].mode = "apply";

    await sendBackMessage(
      from,
      getText(from, "applyStart")
    );

    return;
  }

  // =================================================
  // DOCUMENTS
  // =================================================

  if (buttonId === "menu_documents") {

    users[from].mode = "documents";

    await sendBackMessage(
      from,
      getText(from, "documentsStart")
    );

    return;
  }

  // =================================================
  // LANGUAGE MENU
  // =================================================

  if (buttonId === "menu_language") {

    await sendLanguageMenu(from);

    return;
  }

  // =================================================
  // SCHEME BACK
  // =================================================

  if (buttonId === "scheme_back") {

    await sendMainMenu(from);

    return;
  }
}

// =====================================================
// LIST HANDLER
// =====================================================

async function handleListSelection(
  from,
  listId
) {

  createUser(from);

  // =================================================
  // MAIN MENU
  // =================================================

  if (listId === "menu_language") {

    await sendLanguageMenu(from);
    return;
  }

  if (listId === "menu_ai") {

    users[from].mode = "ai";

    await sendBackMessage(
      from,
      getText(from, "aiStart")
    );

    return;
  }

  if (listId === "menu_schemes") {

    users[from].mode = "schemes";
    users[from].page = 0;

    await sendSchemeList(from);

    return;
  }

  if (listId === "menu_apply") {

    users[from].mode = "apply";

    await sendBackMessage(
      from,
      getText(from, "applyStart")
    );

    return;
  }

  if (listId === "menu_documents") {

    users[from].mode = "documents";

    await sendBackMessage(
      from,
      getText(from, "documentsStart")
    );

    return;
  }

  // =================================================
  // BACK
  // =================================================

  if (listId === "back_menu") {

    await sendMainMenu(from);
    return;
  }

  // =================================================
  // SCHEME
  // =================================================

  if (listId.startsWith("scheme_")) {

    const schemeId =
      listId.replace("scheme_", "");

    // Navigation
    if (schemeId === "next") {

      users[from].page++;

      await sendSchemeList(from);

      return;
    }

    if (schemeId === "previous") {

      users[from].page =
        Math.max(
          0,
          users[from].page - 1
        );

      await sendSchemeList(from);

      return;
    }

    if (schemeId === "back") {

      await sendMainMenu(from);

      return;
    }

    // Scheme details
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

      await sendBackMessage(
        from,
        getText(from, "schemeNotFound")
      );
    }

    return;
  }
}

// =====================================================
// AI QUESTION PROCESSOR
// =====================================================

async function processAIQuestion(
  from,
  question,
  mode
) {

  createUser(from);

  const cleanQuestion =
    question.trim();

  // =================================================
  // PREVENT SAME QUESTION REPEAT
  // =================================================

  if (
    users[from].lastQuestion &&
    users[from].lastQuestion.toLowerCase() ===
      cleanQuestion.toLowerCase()
  ) {

    await sendTextMessage(
      from,
      getText(from, "alreadyAnswered")
    );

    return;
  }

  const answer =
    await askGemini(
      from,
      cleanQuestion,
      mode
    );

  users[from].lastQuestion =
    cleanQuestion;

  users[from].lastAnswer =
    answer;

  users[from].lastMessageTime =
    Date.now();

  await sendBackMessage(
    from,
    answer
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

    let languageInstruction = "";

    if (language === "hi") {

      languageInstruction =
        "Reply ONLY in simple Hindi using Devanagari script.";

    } else if (language === "en") {

      languageInstruction =
        "Reply ONLY in simple English.";

    } else {

      languageInstruction =
        "Reply ONLY in simple Hinglish using Roman Hindi. Do not use Devanagari unless absolutely necessary.";
    }

    // =================================================
    // GET SHEET DATA
    // =================================================

    let schemes = [];

    try {

      schemes =
        await getSchemes();

    } catch (error) {

      console.error(
        "Google Sheet error:",
        error
      );

      schemes = [];
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

    // =================================================
    // MODE RULES
    // =================================================

    let modeInstruction = "";

    if (mode === "ai") {

      modeInstruction = `
MODE: AI HELP

You are in general AI Help mode.

You can answer normal questions and help the citizen
in a friendly, respectful and easy way.

However:
- Do not pretend to be a government officer.
- Do not claim JanSevak can approve applications.
- Do not provide dangerous or illegal instructions.
`;
    }

    if (mode === "schemes") {

      modeInstruction = `
MODE: GOVERNMENT SCHEMES ONLY

IMPORTANT:
You MUST talk ONLY about government schemes.

Do NOT answer unrelated questions.

Use the Google Sheet scheme data as the primary source.

If the user asks something unrelated, politely say that
this section is only for government scheme information.

Never invent a scheme.

Never invent eligibility, benefits or amounts.

If information is missing, tell the user to verify it
from the official government source.
`;
    }

    if (mode === "apply") {

      modeInstruction = `
MODE: APPLY GUIDE ONLY

IMPORTANT:
You MUST talk ONLY about how to apply for a government
scheme or government service.

Focus on:
- Where to apply
- Online/offline process
- Application steps
- What information is generally needed
- Official application portal/source when available

Do NOT turn the conversation into general AI chat.

Never invent an application website or process.

If exact application information is not available,
tell the user to verify it from the official department.
`;
    }

    if (mode === "documents") {

      modeInstruction = `
MODE: DOCUMENTS ONLY

IMPORTANT:
You MUST talk ONLY about documents required for a
government scheme.

If the user has not clearly specified a scheme,
ask them which scheme they want documents for.

Never invent documents.

Use available Google Sheet information if applicable.

If exact documents are not available in the provided data,
clearly say that the citizen should verify the exact
document list from the official government source.
`;
    }

    // =================================================
    // PROMPT
    // =================================================

    const prompt = `
You are "JanSevak AI", a friendly citizen-support
assistant for India.

${languageInstruction}

${modeInstruction}

GENERAL RULES:

1. Keep WhatsApp answers short and easy to understand.
2. Be friendly and respectful.
3. Use useful emojis when appropriate.
4. Never claim to be a government official.
5. Never claim JanSevak can approve an application.
6. Never invent government schemes.
7. Never invent money amounts.
8. Never invent eligibility criteria.
9. Never invent required documents.
10. Never invent official websites.
11. If information is unavailable, clearly say so.
12. Prefer the provided Google Sheet data for schemes.
13. Follow the selected language strictly.
14. Do not repeat the same answer unnecessarily.
15. Do not include a "Back" button in your answer because
    the WhatsApp bot will add it automatically.

AVAILABLE SCHEME DATA:

${schemeContext || "No scheme data is currently available."}

USER QUESTION:

${question}
`;

    console.log(
      `Gemini request | mode=${mode} | question=${question}`
    );

    const response =
      await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt
      });

    const answer =
      response?.text;

    if (
      !answer ||
      !answer.trim()
    ) {

      return getText(
        from,
        "aiUnavailable"
      );
    }

    return answer.trim();

  } catch (error) {

    console.error(
      "Gemini error:",
      error
    );

    return getText(
      from,
      "aiUnavailable"
    );
  }
}

// =====================================================
// GOOGLE SHEET DATA
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

  const json =
    JSON.parse(
      text
        .substring(47)
        .slice(0, -2)
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

    await sendBackMessage(
      to,
      getText(to, "noSchemes")
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

नीचे से योजना चुनें 👇

📄 पेज ${page + 1} / ${totalPages}`;

  } else if (language === "en") {

    body =
`📋 *Government Schemes*

Select a scheme below 👇

📄 Page ${page + 1} / ${totalPages}`;

  } else {

    body =
`📋 *Government Schemes*

Neeche se scheme choose karein 👇

📄 Page ${page + 1} / ${totalPages}`;
  }

  const rows =
    currentSchemes.map(
      scheme => ({
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

  // =================================================
  // PREVIOUS
  // =================================================

  if (page > 0) {

    rows.push({

      id: "scheme_previous",

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

  // =================================================
  // NEXT
  // =================================================

  if (page < totalPages - 1) {

    rows.push({

      id: "scheme_next",

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

  // =================================================
  // BACK
  // =================================================

  rows.push({

    id: "scheme_back",

    title:
      language === "hi"
        ? "⬅️ वापस"
        : language === "en"
        ? "⬅️ Back"
        : "⬅️ Back",

    description:
      language === "hi"
        ? "मुख्य मेनू पर जाएँ"
        : language === "en"
        ? "Go to main menu"
        : "Main menu par jayein"
  });

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
        id: "back_menu",
        title:
          language === "hi"
            ? "⬅️ वापस"
            : "⬅️ Back"
      }
    ]
  );
}

// =====================================================
// SEND BACK MESSAGE
// =====================================================

async function sendBackMessage(
  to,
  message
) {

  const language =
    users[to]?.language ||
    "hinglish";

  await sendTextMessage(
    to,
    message
  );

  await sendButtonMessage(
    to,

    language === "hi"
      ? "👇 मुख्य मेनू पर वापस जाएँ"
      : language === "en"
      ? "👇 Return to main menu"
      : "👇 Main menu par wapas jayein",

    [
      {
        id: "back_menu",
        title:
          language === "hi"
            ? "⬅️ वापस"
            : language === "en"
            ? "⬅️ Back"
            : "⬅️ Back"
      }
    ]
  );
}

// =====================================================
// WHATSAPP BUTTON MESSAGE
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
                  String(body)
                    .substring(0, 1024)
              },

              action: {

                buttons:
                  buttons
                    .slice(0, 3)
                    .map(button => ({

                      type:
                        "reply",

                      reply: {

                        id:
                          button.id,

                        title:
                          String(
                            button.title
                          ).substring(
                            0,
                            20
                          )
                      }
                    }))
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
// WHATSAPP LIST MESSAGE
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
                  String(body)
                    .substring(
                      0,
                      1024
                    )
              },

              action: {

                button:
                  String(
                    buttonText
                  ).substring(
                    0,
                    20
                  ),

                sections: [

                  {

                    title:
                      "JanSevak",

                    rows:
                      rows
                        .slice(
                          0,
                          10
                        )
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
// WHATSAPP TEXT MESSAGE
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

              body:
                String(body)
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

    // =================================================
    // AI START
    // =================================================

    aiStart: {

      hi:
`🤖 *AI सहायता*

नमस्ते! 😊

आप मुझसे कोई भी सामान्य सवाल पूछ सकते हैं।

उदाहरण:
• मुझे पढ़ाई में मदद चाहिए
• भारत की राजधानी क्या है?
• कोई सामान्य जानकारी बताइए

👇 अपना सवाल भेजें।`,

      en:
`🤖 *AI Help*

Hello! 😊

You can ask me any general question.

Examples:
• Help me with my studies
• What is the capital of India?
• Tell me some general information

👇 Send your question.`,

      hinglish:
`🤖 *AI Help*

Hello! 😊

Aap mujhse koi bhi normal/general question pooch sakte hain.

Example:
• Mujhe padhai mein help chahiye
• India ki capital kya hai?
• Koi general information batao

👇 Apna question bhejein.`
    },

    // =================================================
    // APPLY
    // =================================================

    applyStart: {

      hi:
`📝 *आवेदन गाइड*

मैं केवल योजना या सरकारी सेवा के आवेदन की प्रक्रिया के बारे में मदद करूँगा।

आप पूछ सकते हैं:
• इस योजना के लिए आवेदन कैसे करें?
• ऑनलाइन आवेदन कहाँ करें?
• आवेदन की प्रक्रिया क्या है?

👇 अपनी योजना या सेवा का नाम भेजें।`,

      en:
`📝 *Apply Guide*

I will help only with the application process for government schemes or services.

You can ask:
• How do I apply for this scheme?
• Where can I apply online?
• What is the application process?

👇 Send the scheme or service name.`,

      hinglish:
`📝 *Apply Guide*

Main sirf government scheme ya service ke application process ke baare mein help karunga.

Aap pooch sakte hain:
• Is scheme ke liye apply kaise karein?
• Online application kahan karein?
• Application process kya hai?

👇 Scheme ya service ka naam bhejein.`
    },

    // =================================================
    // DOCUMENTS
    // =================================================

    documentsStart: {

      hi:
`📄 *दस्तावेज़*

आप किस योजना के दस्तावेज़ के बारे में जानना चाहते हैं?

👇 योजना का नाम भेजें।`,

      en:
`📄 *Documents*

Which scheme's documents would you like to know about?

👇 Send the scheme name.`,

      hinglish:
`📄 *Documents*

Aap kaun si scheme ke documents ke baare mein jaana chahte hain?

👇 Scheme ka naam bhejein.`
    },

    // =================================================
    // SCHEME NOT FOUND
    // =================================================

    schemeNotFound: {

      hi:
`❌ माफ कीजिए, यह योजना नहीं मिली।

उदाहरण: JH-001`,

      en:
`❌ Sorry, this scheme was not found.

Example: JH-001`,

      hinglish:
`❌ Sorry, ye scheme nahi mili.

Example: JH-001`
    },

    // =================================================
    // NO SCHEMES
    // =================================================

    noSchemes: {

      hi:
        "❌ अभी कोई सरकारी योजना उपलब्ध नहीं है।",

      en:
        "❌ No government schemes are currently available.",

      hinglish:
        "❌ Abhi koi government scheme available nahi hai."
    },

    // =================================================
    // UNKNOWN
    // =================================================

    unknown: {

      hi:
        "🙏 मैं आपका संदेश समझ नहीं पाया। कृपया मुख्य मेनू से कोई विकल्प चुनें।",

      en:
        "🙏 I couldn't understand your message. Please choose an option from the main menu.",

      hinglish:
        "🙏 Main aapka message samajh nahi paya. Please main menu se koi option choose karein."
    },

    // =================================================
    // AI ERROR
    // =================================================

    aiUnavailable: {

      hi:
        "⚠️ AI सेवा अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद दोबारा प्रयास करें।",

      en:
        "⚠️ AI service is currently unavailable. Please try again later.",

      hinglish:
        "⚠️ AI service abhi available nahi hai. Thodi der baad dobara try karein."
    },

    // =================================================
    // SAME QUESTION
    // =================================================

    alreadyAnswered: {

      hi:
        "🙂 मैंने इस सवाल का जवाब अभी दिया है। अगर आपको कुछ नया जानना है तो अपना नया सवाल भेजें।",

      en:
        "🙂 I just answered this question. If you want to know something new, send me a new question.",

      hinglish:
        "🙂 Maine is question ka answer abhi diya hai. Agar kuch naya jaana hai to naya question bhejein."
    },

    // =================================================
    // THANK YOU
    // =================================================

    thankYou: {

      hi:
        "😊 आपका स्वागत है! जब भी जरूरत हो, JanSevak यहाँ है। 🇮🇳",

      en:
        "😊 You're welcome! JanSevak is here whenever you need help. 🇮🇳",

      hinglish:
        "😊 You're welcome! Jab bhi zarurat ho, JanSevak yahan hai. 🇮🇳"
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

      gemini:
        GEMINI_API_KEY
          ? "configured"
          : "missing",

      port:
        PORT,

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
      "🇮🇳 JanSevak WhatsApp Bot is running! ✅"
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
  }
);
