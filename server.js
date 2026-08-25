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
// GOOGLE GEMINI AI
// =====================================================

const { GoogleGenAI } = require("@google/genai");

const ai = GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: GEMINI_API_KEY
    })
  : null;

// =====================================================
// GOOGLE SHEET
// =====================================================

const SHEET_ID =
  "1GeXblMObkNM-KDmMhQPY4ZA8Gv180L_eqb7aNteDu88";

const SHEET_NAME = "Sheet1";

// =====================================================
// USER SESSION
// =====================================================

const users = {};

// =====================================================
// WEBHOOK VERIFICATION
// =====================================================

app.get("/webhook", (req, res) => {

  const mode =
    req.query["hub.mode"];

  const token =
    req.query["hub.verify_token"];

  const challenge =
    req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === VERIFY_TOKEN
  ) {

    console.log(
      "Webhook verified successfully"
    );

    return res
      .status(200)
      .send(challenge);
  }

  return res.sendStatus(403);
});

// =====================================================
// RECEIVE WHATSAPP MESSAGES
// =====================================================

app.post("/webhook", async (req, res) => {

  console.log(
    "WhatsApp webhook:",
    JSON.stringify(
      req.body,
      null,
      2
    )
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

    const from =
      message.from;

    // =================================================
    // CREATE USER SESSION
    // =================================================

    if (!users[from]) {

      users[from] = {

        language: null,

        page: 0,

        mode: "language",

        lastQuestion: "",

        lastAnswer: "",

        lastMessageTime: 0

      };

    }

    // =================================================
    // TEXT MESSAGE
    // =================================================

    if (
      message.type === "text"
    ) {

      const text =
        message.text?.body?.trim() ||
        "";

      await handleTextMessage(
        from,
        text
      );

      return res.sendStatus(200);
    }

    // =================================================
    // INTERACTIVE MESSAGE
    // =================================================

    if (
      message.type === "interactive"
    ) {

      const interactive =
        message.interactive;

      // -----------------------------------------------
      // REPLY BUTTON
      // -----------------------------------------------

      if (
        interactive?.type ===
        "button_reply"
      ) {

        const buttonId =
          interactive
            .button_reply
            ?.id;

        await handleButton(
          from,
          buttonId
        );

        return res.sendStatus(200);
      }

      // -----------------------------------------------
      // LIST REPLY
      // -----------------------------------------------

      if (
        interactive?.type ===
        "list_reply"
      ) {

        const listId =
          interactive
            .list_reply
            ?.id;

        await handleListSelection(
          from,
          listId
        );

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
// PLACEHOLDER HANDLERS
// =====================================================
// Ye functions next parts mein complete honge.
// Abhi inhe touch mat karna.

async function handleTextMessage(
  from,
  text
) {

  console.log(
    "Text received:",
    from,
    text
  );

}

async function handleButton(
  from,
  buttonId
) {

  console.log(
    "Button clicked:",
    from,
    buttonId
  );

}

async function handleListSelection(
  from,
  listId
) {

  console.log(
    "List selected:",
    from,
    listId
  );

}

// =====================================================
// START SERVER
// =====================================================

app.get(
  "/health",
  (req, res) => {

    res.status(200).json({

      status: "ok",

      service:
        "JanSevak WhatsApp Bot",

      gemini:
        GEMINI_API_KEY
          ? "configured"
          : "missing",

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

    console.log(
      `Gemini AI: ${
        GEMINI_API_KEY
          ? "Configured ✅"
          : "Missing ❌"
      }`
    );

  }
);
// =====================================================
// PART 2
// LANGUAGE + MAIN MENU SYSTEM
// =====================================================

// =====================================================
// SET USER LANGUAGE
// =====================================================

function setLanguage(from, language) {

  if (!users[from]) {

    users[from] = {

      language: language,

      page: 0,

      mode: "main",

      lastQuestion: "",

      lastAnswer: "",

      lastMessageTime: 0

    };

  } else {

    users[from].language =
      language;

    users[from].mode =
      "main";

  }

}

// =====================================================
// GET USER LANGUAGE
// =====================================================

function getLanguage(from) {

  return (
    users[from]?.language ||
    null
  );

}

// =====================================================
// LANGUAGE MENU
// =====================================================

async function sendLanguageMenu(to) {

  await sendButtonMessage(
    to,

`👋 *Welcome to JanSevak!*

🌐 Please select your language.

1️⃣ English
2️⃣ हिंदी
3️⃣ Hinglish

👇 Choose your language:`,
    [
      {
        id: "language_english",
        title: "🇬🇧 English"
      },
      {
        id: "language_hindi",
        title: "🇮🇳 हिंदी"
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

  // ---------------------------------------------------
  // HINDI
  // ---------------------------------------------------

  if (language === "hi") {

    message =
`👋 *जनसेवक में आपका स्वागत है!*

मैं आपको सरकारी योजनाओं और आवेदन से जुड़ी जानकारी समझने में मदद कर सकता हूँ।

👇 कृपया नीचे से एक विकल्प चुनें:`;

  }

  // ---------------------------------------------------
  // ENGLISH
  // ---------------------------------------------------

  else if (language === "en") {

    message =
`👋 *Welcome to JanSevak!*

I can help you understand government schemes, application processes and required documents.

👇 Please choose an option below:`;

  }

  // ---------------------------------------------------
  // HINGLISH
  // ---------------------------------------------------

  else {

    message =
`👋 *JanSevak mein aapka swagat hai!*

Main aapko government schemes, application process aur required documents ke baare mein help kar sakta hoon.

👇 Neeche se ek option choose karein:`;

  }

  // ===================================================
  // FIVE MAIN OPTIONS
  // ===================================================
  //
  // WhatsApp mein ek reply-button message mein
  // maximum 3 buttons hote hain.
  //
  // Isliye yahan LIST MESSAGE use kiya jayega.
  // ===================================================

  await sendListMessage(
    to,
    message,

    language === "hi"
      ? "विकल्प चुनें"
      : language === "en"
      ? "Choose Option"
      : "Option Choose Karein",

    [

      // -----------------------------------------------
      // LANGUAGE
      // -----------------------------------------------

      {
        id: "menu_language",

        title:
          language === "hi"
            ? "🌐 भाषा"
            : language === "en"
            ? "🌐 Language"
            : "🌐 Language",

        description:
          language === "hi"
            ? "अपनी भाषा बदलें"
            : language === "en"
            ? "Change your language"
            : "Apni language change karein"
      },

      // -----------------------------------------------
      // AI HELP
      // -----------------------------------------------

      {
        id: "menu_ai",

        title:
          language === "hi"
            ? "🤖 AI सहायता"
            : language === "en"
            ? "🤖 AI Help"
            : "🤖 AI Help",

        description:
          language === "hi"
            ? "AI से सामान्य मदद लें"
            : language === "en"
            ? "Get friendly help from AI"
            : "AI se friendly help lein"
      },

      // -----------------------------------------------
      // SCHEMES
      // -----------------------------------------------

      {
        id: "menu_schemes",

        title:
          language === "hi"
            ? "📋 योजनाएँ"
            : language === "en"
            ? "📋 Schemes"
            : "📋 Schemes",

        description:
          language === "hi"
            ? "सरकारी योजनाओं की जानकारी"
            : language === "en"
            ? "Government scheme information"
            : "Government schemes ki information"
      },

      // -----------------------------------------------
      // APPLY GUIDE
      // -----------------------------------------------

      {
        id: "menu_apply",

        title:
          language === "hi"
            ? "📝 आवेदन गाइड"
            : language === "en"
            ? "📝 Apply Guide"
            : "📝 Apply Guide",

        description:
          language === "hi"
            ? "योजना के लिए आवेदन कैसे करें"
            : language === "en"
            ? "How to apply for a scheme"
            : "Scheme ke liye apply kaise karein"
      },

      // -----------------------------------------------
      // DOCUMENTS
      // -----------------------------------------------

      {
        id: "menu_documents",

        title:
          language === "hi"
            ? "📄 दस्तावेज़"
            : language === "en"
            ? "📄 Documents"
            : "📄 Documents",

        description:
          language === "hi"
            ? "योजना के लिए जरूरी दस्तावेज़"
            : language === "en"
            ? "Required documents for a scheme"
            : "Scheme ke required documents"
      }

    ]
  );

}

// =====================================================
// WELCOME AFTER LANGUAGE SELECTION
// =====================================================

async function sendLanguageWelcome(to) {

  const language =
    users[to]?.language ||
    "hinglish";

  let message = "";

  if (language === "hi") {

    message =
`🇮🇳 *जनसेवक में आपका स्वागत है!*

आपने *हिंदी* भाषा चुनी है। ✅

अब मैं आपको हिंदी में जानकारी और मार्गदर्शन दूँगा।`;

  }

  else if (language === "en") {

    message =
`🇮🇳 *Welcome to JanSevak!*

You selected *English*. ✅

I will now guide you in English.`;

  }

  else {

    message =
`🇮🇳 *JanSevak mein aapka swagat hai!*

Aapne *Hinglish* select kiya hai. ✅

Ab main aapko Hinglish mein guide karunga.`;

  }

  await sendTextMessage(
    to,
    message
  );

  await sendMainMenu(to);

}

// =====================================================
// TEXT MESSAGE HANDLER
// =====================================================

async function handleTextMessage(
  from,
  originalText
) {

  const text =
    originalText
      .trim()
      .toLowerCase();

  // ===================================================
  // USER SESSION CHECK
  // ===================================================

  if (!users[from]) {

    users[from] = {

      language: null,

      page: 0,

      mode: "language",

      lastQuestion: "",

      lastAnswer: "",

      lastMessageTime: 0

    };

  }

  // ===================================================
  // FIRST GREETING
  // ===================================================

  if (
    text === "hi" ||
    text === "hello" ||
    text === "hey" ||
    text === "namaste" ||
    text === "start" ||
    text === "/start"
  ) {

    // Reset language selection

    users[from].language =
      null;

    users[from].mode =
      "language";

    users[from].lastQuestion =
      "";

    users[from].lastAnswer =
      "";

    await sendLanguageMenu(from);

    return;

  }

  // ===================================================
  // LANGUAGE SELECTION BY TEXT
  // ===================================================

  if (
    text === "english"
  ) {

    setLanguage(
      from,
      "en"
    );

    await sendLanguageWelcome(from);

    return;

  }

  if (
    text === "hindi" ||
    text === "हिंदी"
  ) {

    setLanguage(
      from,
      "hi"
    );

    await sendLanguageWelcome(from);

    return;

  }

  if (
    text === "hinglish"
  ) {

    setLanguage(
      from,
      "hinglish"
    );

    await sendLanguageWelcome(from);

    return;

  }

  // ===================================================
  // IF LANGUAGE NOT SELECTED
  // ===================================================

  if (
    !users[from].language
  ) {

    await sendLanguageMenu(from);

    return;

  }

  // ===================================================
  // THANK YOU / DONE
  // ===================================================

  if (
    text === "thank you" ||
    text === "thanks" ||
    text === "thank u" ||
    text === "thankyou" ||
    text === "done" ||
    text === "ok thanks" ||
    text === "okay thanks"
  ) {

    const language =
      users[from].language;

    const reply =
      language === "hi"
        ? "🙏 आपका स्वागत है! 😊"
        : language === "en"
        ? "🙏 You're welcome! 😊"
        : "🙏 You're welcome! 😊";

    await sendTextMessage(
      from,
      reply
    );

    return;

  }

  // ===================================================
  // HOME / MENU
  // ===================================================

  if (
    text === "home" ||
    text === "menu" ||
    text === "main menu" ||
    text === "मुख्य मेनू" ||
    text === "मेनू"
  ) {

    users[from].mode =
      "main";

    await sendMainMenu(from);

    return;

  }

  // ===================================================
  // BACK
  // ===================================================

  if (
    text === "back" ||
    text === "पीछे"
  ) {

    users[from].mode =
      "main";

    await sendMainMenu(from);

    return;

  }

  // ===================================================
  // SAME MESSAGE REPEAT PROTECTION
  // ===================================================

  const now =
    Date.now();

  if (
    users[from].lastQuestion ===
      originalText.trim() &&
    now -
      users[from].lastMessageTime <
      5000
  ) {

    console.log(
      "Duplicate message ignored:",
      originalText
    );

    return;

  }

  users[from].lastQuestion =
    originalText.trim();

  users[from].lastMessageTime =
    now;

  // ===================================================
  // MODE BASED PROCESSING
  // ===================================================

  const mode =
    users[from].mode;

  // ---------------------------------------------------
  // AI MODE
  // ---------------------------------------------------

  if (
    mode === "ai"
  ) {

    const aiReply =
      await askGemini(
        from,
        originalText,
        "ai"
      );

    await sendControlledAIReply(
      from,
      aiReply
    );

    return;

  }

  // ---------------------------------------------------
  // SCHEME MODE
  // ---------------------------------------------------

  if (
    mode === "schemes"
  ) {

    const aiReply =
      await askGemini(
        from,
        originalText,
        "schemes"
      );

    await sendControlledAIReply(
      from,
      aiReply
    );

    return;

  }

  // ---------------------------------------------------
  // APPLY MODE
  // ---------------------------------------------------

  if (
    mode === "apply"
  ) {

    const aiReply =
      await askGemini(
        from,
        originalText,
        "apply"
      );

    await sendControlledAIReply(
      from,
      aiReply
    );

    return;

  }

  // ---------------------------------------------------
  // DOCUMENT MODE
  // ---------------------------------------------------

  if (
    mode === "documents"
  ) {

    const aiReply =
      await askGemini(
        from,
        originalText,
        "documents"
      );

    await sendControlledAIReply(
      from,
      aiReply
    );

    return;

  }

  // ===================================================
  // DEFAULT
  // ===================================================

  await sendMainMenu(from);

}

// =====================================================
// CONTROLLED AI REPLY
// =====================================================

async function sendControlledAIReply(
  from,
  answer
) {

  if (!answer) {
    return;
  }

  const cleanAnswer =
    String(answer).trim();

  // Same answer protection
  if (
    users[from].lastAnswer ===
    cleanAnswer
  ) {

    console.log(
      "Duplicate AI answer ignored."
    );

    return;

  }

  users[from].lastAnswer =
    cleanAnswer;

  await sendTextMessage(
    from,
    cleanAnswer
  );

  await sendBackButton(
    from
  );

}

// =====================================================
// BACK BUTTON
// =====================================================

async function sendBackButton(to) {

  const language =
    users[to]?.language ||
    "hinglish";

  await sendButtonMessage(
    to,

    language === "hi"
      ? "👇 मुख्य मेनू पर वापस जाएँ:"
      : language === "en"
      ? "👇 Go back to the main menu:"
      : "👇 Main menu par wapas jaayein:",

    [
      {
        id: "main_back",
        title:
          language === "hi"
            ? "⬅️ मुख्य मेनू"
            : language === "en"
            ? "⬅️ Main Menu"
            : "⬅️ Main Menu"
      }
    ]
  );

}

// =====================================================
// BUTTON HANDLER
// =====================================================

async function handleButton(
  from,
  buttonId
) {

  // ===================================================
  // LANGUAGE
  // ===================================================

  if (
    buttonId ===
    "language_hindi"
  ) {

    setLanguage(
      from,
      "hi"
    );

    await sendLanguageWelcome(from);

    return;

  }

  if (
    buttonId ===
    "language_english"
  ) {

    setLanguage(
      from,
      "en"
    );

    await sendLanguageWelcome(from);

    return;

  }

  if (
    buttonId ===
    "language_hinglish"
  ) {

    setLanguage(
      from,
      "hinglish"
    );

    await sendLanguageWelcome(from);

    return;

  }

  // ===================================================
  // MAIN MENU - LANGUAGE
  // ===================================================

  if (
    buttonId ===
    "menu_language"
  ) {

    users[from].mode =
      "language";

    await sendLanguageMenu(from);

    return;

  }

  // ===================================================
  // MAIN MENU - AI
  // ===================================================

  if (
    buttonId ===
    "menu_ai"
  ) {

    users[from].mode =
      "ai";

    await sendAIWelcome(from);

    return;

  }

  // ===================================================
  // MAIN MENU - SCHEMES
  // ===================================================

  if (
    buttonId ===
    "menu_schemes"
  ) {

    users[from].mode =
      "schemes";

    users[from].page =
      0;

    await sendSchemeList(from);

    return;

  }

  // ===================================================
  // MAIN MENU - APPLY
  // ===================================================

  if (
    buttonId ===
    "menu_apply"
  ) {

    users[from].mode =
      "apply";

    await sendApplyWelcome(from);

    return;

  }

  // ===================================================
  // MAIN MENU - DOCUMENTS
  // ===================================================

  if (
    buttonId ===
    "menu_documents"
  ) {

    users[from].mode =
      "documents";

    await sendDocumentsWelcome(from);

    return;

  }

  // ===================================================
  // MAIN MENU BACK
  // ===================================================

  if (
    buttonId ===
    "main_back"
  ) {

    users[from].mode =
      "main";

    await sendMainMenu(from);

    return;

  }

}

// =====================================================
// AI WELCOME
// =====================================================

async function sendAIWelcome(to) {

  const language =
    users[to]?.language ||
    "hinglish";

  const message =
    language === "hi"
      ? `🤖 *AI सहायता*

नमस्ते! 😊
आप मुझसे सामान्य सवाल पूछ सकते हैं। मैं दोस्ताना तरीके से आपकी मदद करने की कोशिश करूँगा।

👇 अपना सवाल लिखें।`

      : language === "en"
      ? `🤖 *AI Help*

Hello! 😊
You can ask me general questions and I'll try to help you in a friendly way.

👇 Type your question.`

      : `🤖 *AI Help*

Hello! 😊
Aap mujhse normal/general questions pooch sakte hain. Main friendly way mein help karunga.

👇 Apna question type karein.`;

  await sendTextMessage(
    to,
    message
  );

  await sendBackButton(to);

}

// =====================================================
// APPLY WELCOME
// =====================================================

async function sendApplyWelcome(to) {

  const language =
    users[to]?.language ||
    "hinglish";

  const message =
    language === "hi"
      ? `📝 *आवेदन गाइड*

मैं आपको सरकारी योजना के लिए आवेदन करने की प्रक्रिया समझाने में मदद कर सकता हूँ।

👉 कृपया उस योजना का नाम या ID भेजें।

उदाहरण: *JH-001*`

      : language === "en"
      ? `📝 *Apply Guide*

I can help you understand how to apply for a government scheme.

👉 Please send the scheme name or ID.

Example: *JH-001*`

      : `📝 *Apply Guide*

Main aapko government scheme ke liye apply karne ka process samjhane mein help karunga.

👉 Scheme ka naam ya ID bhejein.

Example: *JH-001*`;

  await sendTextMessage(
    to,
    message
  );

  await sendBackButton(to);

}

// =====================================================
// DOCUMENT WELCOME
// =====================================================

async function sendDocumentsWelcome(to) {

  const language =
    users[to]?.language ||
    "hinglish";

  const message =
    language === "hi"
      ? `📄 *दस्तावेज़*

आप किस सरकारी योजना के दस्तावेज़ के बारे में जानना चाहते हैं?

👉 कृपया योजना का नाम या ID भेजें।

उदाहरण: *JH-001*`

      : language === "en"
      ? `📄 *Documents*

Which government scheme's documents would you like to know about?

👉 Please send the scheme name or ID.

Example: *JH-001*`

      : `📄 *Documents*

Aap kaun si government scheme ke documents ke baare mein jaana chahte hain?

👉 Scheme ka naam ya ID bhejein.

Example: *JH-001*`;

  await sendTextMessage(
    to,
    message
  );

  await sendBackButton(to);

}
// =====================================================
// PART 3 — SCHEMES + AI + WHATSAPP API
// =====================================================

// =====================================================
// GOOGLE SHEET — GET SCHEMES
// =====================================================

async function getSchemes() {

  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Google Sheet HTTP error: ${response.status}`
    );
  }

  const text = await response.text();

  const json = JSON.parse(
    text.substring(47).slice(0, -2)
  );

  const rows = json.table?.rows || [];

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
// GEMINI AI
// =====================================================

async function askGemini(
  from,
  question,
  mode = "general"
) {

  try {

    if (!ai) {

      return getText(
        from,
        "aiUnavailable"
      );

    }

    const language =
      users[from]?.language || "hinglish";


    // -------------------------------------------------
    // LANGUAGE
    // -------------------------------------------------

    let languageInstruction = "";

    if (language === "hi") {

      languageInstruction =
        "Reply only in simple Hindi using Devanagari script.";

    } else if (language === "en") {

      languageInstruction =
        "Reply only in simple English.";

    } else {

      languageInstruction =
        "Reply only in simple Hinglish using Roman Hindi.";

    }


    // -------------------------------------------------
    // MODE
    // -------------------------------------------------

    let modeInstruction = "";

    if (mode === "ai") {

      modeInstruction = `
You are JanSevak AI Friend.

The user clicked AI Help.

You can have friendly and useful conversations.

You may answer:
- General questions
- Study questions
- Technology questions
- Daily life questions
- Government related questions
- Other normal questions

Be friendly, natural and respectful.

Do NOT pretend to be a government officer.

Keep answers reasonably short for WhatsApp.
`;

    } else if (mode === "schemes") {

      modeInstruction = `
The user is currently inside the GOVERNMENT SCHEMES section.

IMPORTANT:
Only talk about government schemes.

You may explain:
- Scheme name
- Eligibility
- Benefits
- Who can apply
- Documents
- Basic scheme information

Do NOT answer unrelated questions.

If the user asks something unrelated, politely say that this section is only for government schemes and ask them to use AI Help for general questions.
`;

    } else if (mode === "apply") {

      modeInstruction = `
The user is currently inside APPLY GUIDE.

IMPORTANT:
Only talk about applying for government schemes.

You may explain:
- How to apply
- Where to apply
- Application steps
- Basic application process
- Documents required for application

Do NOT answer unrelated questions.

If the user asks something unrelated, politely say that this section is only for application guidance.
`;

    } else if (mode === "documents") {

      modeInstruction = `
The user is currently inside DOCUMENTS.

IMPORTANT:
Only talk about documents required for government schemes.

First understand which scheme the user wants.

You can explain:
- Required documents
- Document preparation
- Basic document requirements

Do NOT answer unrelated questions.
`;

    }


    // -------------------------------------------------
    // GET SCHEMES
    // -------------------------------------------------

    let schemes = [];

    try {

      schemes =
        await getSchemes();

    } catch (error) {

      console.error(
        "Google Sheet error:",
        error
      );

    }


    // -------------------------------------------------
    // SCHEME DATA
    // -------------------------------------------------

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


    // -------------------------------------------------
    // DOCUMENT MODE
    // -------------------------------------------------

    if (mode === "documents") {

      const documentPrompt = `

You are JanSevak Documents Assistant.

${languageInstruction}

${modeInstruction}

The user said:

${question}

AVAILABLE SCHEMES:

${schemeContext || "No scheme data available."}

If the user has not clearly mentioned a scheme:

Ask:

"Which scheme's documents would you like to know about?"

Then wait for the user's answer.

Never invent document requirements.

If information is not available in the provided data,
tell the user to verify it from the official government source.

`;

      return await generateGeminiResponse(
        from,
        documentPrompt
      );

    }


    // -------------------------------------------------
    // NORMAL AI PROMPT
    // -------------------------------------------------

    const prompt = `

You are JanSevak AI.

${languageInstruction}

${modeInstruction}

IMPORTANT RULES:

1. Never invent government schemes.
2. Never invent eligibility.
3. Never invent benefits.
4. Never invent document requirements.
5. Use the Google Sheet data when discussing schemes.
6. If information is unavailable, clearly say so.
7. Do not claim JanSevak can approve applications.
8. Keep WhatsApp replies concise.
9. Be friendly and helpful.
10. Always use the user's selected language.

AVAILABLE SCHEME DATA:

${schemeContext || "No scheme data available."}

USER MESSAGE:

${question}

`;

    return await generateGeminiResponse(
      from,
      prompt
    );

  } catch (error) {

    console.error(
      "Gemini Function Error:",
      error
    );

    return getText(
      from,
      "aiUnavailable"
    );

  }
}


// =====================================================
// GEMINI REQUEST
// =====================================================

async function generateGeminiResponse(
  from,
  prompt
) {

  const models = [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite"
  ];

  const maxRetries = 2;

  for (const model of models) {

    for (
      let attempt = 1;
      attempt <= maxRetries;
      attempt++
    ) {

      try {

        console.log(
          `Gemini request: ${model} attempt ${attempt}`
        );

        const response =
          await ai.models.generateContent({

            model,

            contents:
              prompt

          });

        const answer =
          response?.text;

        if (
          !answer ||
          !answer.trim()
        ) {

          throw new Error(
            "Gemini returned empty response"
          );

        }

        console.log(
          "Gemini response successful"
        );

        return answer.trim();

      } catch (error) {

        const message =
          error?.message ||
          String(error);

        const status =
          error?.status ||
          error?.code ||
          "";

        console.error(
          `Gemini error: ${message}`
        );


        const temporary =
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504 ||
          message.includes("UNAVAILABLE") ||
          message.includes("overloaded") ||
          message.includes("temporarily");


        if (
          temporary &&
          attempt < maxRetries
        ) {

          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                attempt * 2000
              )
          );

          continue;

        }


        if (
          temporary ||
          status === 404
        ) {

          break;

        }


        if (
          status === 401 ||
          status === 403
        ) {

          return getText(
            from,
            "aiUnavailable"
          );

        }

        break;

      }

    }

  }


  return getText(
    from,
    "aiUnavailable"
  );

}


// =====================================================
// SEND WHATSAPP TEXT
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

        method:
          "POST",

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
    "WhatsApp text response:",
    data
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

        method:
          "POST",

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
                    .map(button => ({

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

                    }))

              }

            }

          })

      }
    );


  const data =
    await response.json();

  console.log(
    "WhatsApp button response:",
    data
  );

}


// =====================================================
// SEND WHATSAPP LIST
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

        method:
          "POST",

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
                  buttonText.substring(
                    0,
                    20
                  ),

                sections: [

                  {

                    title:
                      "JanSevak",

                    rows:
                      rows.slice(
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
    "WhatsApp list response:",
    data
  );

}


// =====================================================
// LANGUAGE TEXT
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
        "❌ माफ कीजिए, यह योजना नहीं मिली।",

      en:
        "❌ Sorry, this scheme was not found.",

      hinglish:
        "❌ Sorry, ye scheme nahi mili."

    },


    invalidOption: {

      hi:
        "🙏 कृपया उपलब्ध विकल्प चुनें।",

      en:
        "🙏 Please choose a valid option.",

      hinglish:
        "🙏 Kripya available option choose karein."

    },


    noSchemes: {

      hi:
        "❌ अभी कोई सरकारी योजना उपलब्ध नहीं है।",

      en:
        "❌ No government schemes are currently available.",

      hinglish:
        "❌ Abhi koi government scheme available nahi hai."

    },


    aiUnavailable: {

      hi:
        "⚠️ AI सेवा अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद प्रयास करें।",

      en:
        "⚠️ AI service is currently unavailable. Please try again later.",

      hinglish:
        "⚠️ AI service abhi available nahi hai. Thodi der baad try karein."

    },


    unknown: {

      hi:
        "🙏 मैं आपका संदेश समझ नहीं पाया। कृपया नीचे दिए गए विकल्पों में से चुनें।",

      en:
        "🙏 I couldn't understand your message. Please choose one of the options below.",

      hinglish:
        "🙏 Main aapka message samajh nahi paya. Neeche diye options me se choose karein."

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
// SERVER START
// =====================================================

app.listen(
  PORT,
  () => {

    console.log(
      `🇮🇳 JanSevak server running on port ${PORT}`
    );

    console.log(
      `Gemini AI: ${
        GEMINI_API_KEY
          ? "Configured ✅"
          : "Missing ❌"
      }`
    );

  }
);
