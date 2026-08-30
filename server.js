const express = require("express");

const app = express();

app.use(express.json());

const PORT =
  process.env.PORT || 3000;

// =====================================================
// ENVIRONMENT VARIABLES
// =====================================================

const VERIFY_TOKEN =
  process.env.VERIFY_TOKEN;

const PHONE_NUMBER_ID =
  process.env.PHONE_NUMBER_ID;

const WHATSAPP_TOKEN =
  process.env.WHATSAPP_TOKEN;

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;


// =====================================================
// GEMINI AI
// =====================================================

const {
  GoogleGenAI
} = require("@google/genai");


const ai =
  GEMINI_API_KEY
    ? new GoogleGenAI({
        apiKey: GEMINI_API_KEY
      })
    : null;


// Current default Gemini model.
// Can be overridden from Render Environment Variables.
const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-3.7-flash";


// =====================================================
// GOOGLE SHEET
// =====================================================
//
// IMPORTANT:
//
// Google Sheet is used ONLY in SCHEMES mode.
//
// It is NOT used in:
// - AI Help
// - Apply Guide
// - Documents
//
// =====================================================

const SHEET_ID =
  "1GeXblMObkNM-KDmMhQPY4ZA8Gv180L_eqb7aNteDu88";

const SHEET_NAME =
  "Sheet1";


// =====================================================
// USER SESSIONS
// =====================================================

const users = {};


// =====================================================
// WEBHOOK VERIFICATION
// =====================================================

app.get(
  "/webhook",
  (req, res) => {

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
        "Webhook verified successfully ✅"
      );

      return res
        .status(200)
        .send(challenge);
    }


    return res.sendStatus(403);
  }
);


// =====================================================
// RECEIVE WHATSAPP MESSAGES
// =====================================================

app.post(
  "/webhook",
  async (req, res) => {

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


      // Delivery/read/status webhook
      if (!message) {

        return res.sendStatus(200);
      }


      const from =
        message.from;


      createUser(from);


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


        // BUTTON
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


        // LIST
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
  }
);


// =====================================================
// CREATE USER
// =====================================================

function createUser(from) {

  if (!users[from]) {

    users[from] = {

      language:
        null,

      mode:
        "language",

      page:
        0,

      lastQuestion:
        "",

      lastAnswer:
        "",

      lastMessageTime:
        0
    };
  }
}


// =====================================================
// TEXT HANDLER
// =====================================================

async function handleTextMessage(
  from,
  originalText
) {

  createUser(from);


  const rawText =
    originalText.trim();


  const text =
    rawText.toLowerCase();


  // =================================================
  // THANK YOU
  // =================================================

  if (
    isThankYou(text)
  ) {

    await sendTextMessage(
      from,
      getText(
        from,
        "thankYou"
      )
    );


    return;
  }


  // =================================================
  // GREETING
  // =================================================

  if (
    isGreeting(text)
  ) {

    await sendLanguageMenu(
      from
    );


    return;
  }


  // =================================================
  // LANGUAGE
  // =================================================

  if (
    text === "hindi" ||
    text === "हिंदी" ||
    text === "1"
  ) {

    setLanguage(
      from,
      "hi"
    );


    await sendMainMenu(
      from
    );


    return;
  }


  if (
    text === "english" ||
    text === "अंग्रेजी" ||
    text === "2"
  ) {

    setLanguage(
      from,
      "en"
    );


    await sendMainMenu(
      from
    );


    return;
  }


  if (
    text === "hinglish" ||
    text === "हिंग्लिश" ||
    text === "3"
  ) {

    setLanguage(
      from,
      "hinglish"
    );


    await sendMainMenu(
      from
    );


    return;
  }


  // =================================================
  // BACK
  // =================================================

  if (
    isBackCommand(text)
  ) {

    await sendMainMenu(
      from
    );


    return;
  }


  // =================================================
  // HOME
  // =================================================

  if (
    isHomeCommand(text)
  ) {

    await sendMainMenu(
      from
    );


    return;
  }


  // =================================================
  // LANGUAGE NOT SELECTED
  // =================================================

  if (
    !users[from].language
  ) {

    await sendLanguageMenu(
      from
    );


    return;
  }


  // =================================================
  // AI MODE
  // =================================================

  if (
    users[from].mode === "ai"
  ) {

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

  if (
    users[from].mode ===
    "schemes"
  ) {

    // Direct Scheme ID
    if (
      /^jh-\d+$/i.test(
        rawText
      )
    ) {

      const schemes =
        await getSchemes();


      const scheme =
        schemes.find(
          item =>
            item.id
              .toLowerCase() ===
            rawText
              .toLowerCase()
        );


      if (scheme) {

        await sendSchemeDetails(
          from,
          scheme
        );

      } else {

        await sendBackMessage(
          from,
          getText(
            from,
            "schemeNotFound"
          )
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
  // APPLY MODE
  // =================================================

  if (
    users[from].mode ===
    "apply"
  ) {

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

  if (
    users[from].mode ===
    "documents"
  ) {

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
    getText(
      from,
      "unknown"
    )
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


  return greetings.includes(
    text
  );
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


  return words.includes(
    text
  );
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


  return commands.includes(
    text
  );
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


  return commands.includes(
    text
  );
}


// =====================================================
// LANGUAGE
// =====================================================

function setLanguage(
  from,
  language
) {

  createUser(from);


  users[from].language =
    language;

  users[from].mode =
    "menu";

  users[from].page =
    0;

  users[from].lastQuestion =
    "";

  users[from].lastAnswer =
    "";

  users[from].lastMessageTime =
    0;
}


// =====================================================
// LANGUAGE MENU
// =====================================================

async function sendLanguageMenu(
  to
) {

  await sendButtonMessage(

    to,

`👋 Welcome to JanSevak!

🌐 Please select your language
👇 Apni language choose karein`,

    [

      {
        id:
          "language_hindi",

        title:
          "🇮🇳 हिंदी"
      },

      {
        id:
          "language_english",

        title:
          "🇬🇧 English"
      },

      {
        id:
          "language_hinglish",

        title:
          "😎 Hinglish"
      }

    ]
  );
}


// =====================================================
// MAIN MENU
// =====================================================

async function sendMainMenu(
  to
) {

  createUser(to);


  users[to].mode =
    "menu";


  const language =
    users[to].language ||
    "hinglish";


  let body = "";

  let rows = [];


  // =================================================
  // HINDI
  // =================================================

  if (
    language === "hi"
  ) {

    body =
`👋 *जनसेवक में आपका स्वागत है!*

मैं आपको सरकारी योजनाओं और आवेदन से जुड़ी जानकारी समझने में मदद कर सकता हूँ।

👇 कृपया एक विकल्प चुनें:`;


    rows = [

      {
        id:
          "menu_language",

        title:
          "🌐 भाषा",

        description:
          "भाषा बदलें"
      },

      {
        id:
          "menu_ai",

        title:
          "🤖 AI सहायता",

        description:
          "सामान्य सहायता प्राप्त करें"
      },

      {
        id:
          "menu_schemes",

        title:
          "📋 योजनाएँ",

        description:
          "सरकारी योजनाओं की जानकारी"
      },

      {
        id:
          "menu_apply",

        title:
          "📝 आवेदन गाइड",

        description:
          "आवेदन करने की प्रक्रिया"
      },

      {
        id:
          "menu_documents",

        title:
          "📄 दस्तावेज़",

        description:
          "योजना के दस्तावेज़ जानें"
      }
    ];
  }


  // =================================================
  // ENGLISH
  // =================================================

  else if (
    language === "en"
  ) {

    body =
`👋 *Welcome to JanSevak!*

I can help you understand government schemes and application-related information.

👇 Please choose an option:`;


    rows = [

      {
        id:
          "menu_language",

        title:
          "🌐 Language",

        description:
          "Change language"
      },

      {
        id:
          "menu_ai",

        title:
          "🤖 AI Help",

        description:
          "Get general assistance"
      },

      {
        id:
          "menu_schemes",

        title:
          "📋 Schemes",

        description:
          "Government scheme information"
      },

      {
        id:
          "menu_apply",

        title:
          "📝 Apply Guide",

        description:
          "Application process guidance"
      },

      {
        id:
          "menu_documents",

        title:
          "📄 Documents",

        description:
          "Know required documents"
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
        id:
          "menu_language",

        title:
          "🌐 Language",

        description:
          "Language change karein"
      },

      {
        id:
          "menu_ai",

        title:
          "🤖 AI Help",

        description:
          "General help lein"
      },

      {
        id:
          "menu_schemes",

        title:
          "📋 Schemes",

        description:
          "Government schemes ki information"
      },

      {
        id:
          "menu_apply",

        title:
          "📝 Apply Guide",

        description:
          "Application process samjhein"
      },

      {
        id:
          "menu_documents",

        title:
          "📄 Documents",

        description:
          "Required documents jaanen"
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

async function handleButton(
  from,
  buttonId
) {

  createUser(from);


  // =================================================
  // LANGUAGE
  // =================================================

  if (
    buttonId ===
    "language_hindi"
  ) {

    setLanguage(
      from,
      "hi"
    );

    await sendMainMenu(
      from
    );

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

    await sendMainMenu(
      from
    );

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

    await sendMainMenu(
      from
    );

    return;
  }


  // =================================================
  // BACK
  // =================================================

  if (
    buttonId ===
    "back_menu"
  ) {

    await sendMainMenu(
      from
    );

    return;
  }


  // =================================================
  // AI
  // =================================================

  if (
    buttonId ===
    "menu_ai"
  ) {

    users[from].mode =
      "ai";


    users[from].lastQuestion =
      "";


    await sendBackMessage(

      from,

      getText(
        from,
        "aiStart"
      )
    );


    return;
  }


  // =================================================
  // SCHEMES
  // =================================================

  if (
    buttonId ===
    "menu_schemes"
  ) {

    users[from].mode =
      "schemes";

    users[from].page =
      0;

    users[from].lastQuestion =
      "";


    await sendSchemeList(
      from
    );


    return;
  }


  // =================================================
  // APPLY
  // =================================================

  if (
    buttonId ===
    "menu_apply"
  ) {

    users[from].mode =
      "apply";


    users[from].lastQuestion =
      "";


    await sendBackMessage(

      from,

      getText(
        from,
        "applyStart"
      )
    );


    return;
  }


  // =================================================
  // DOCUMENTS
  // =================================================

  if (
    buttonId ===
    "menu_documents"
  ) {

    users[from].mode =
      "documents";


    users[from].lastQuestion =
      "";


    await sendBackMessage(

      from,

      getText(
        from,
        "documentsStart"
      )
    );


    return;
  }


  // =================================================
  // LANGUAGE MENU
  // =================================================

  if (
    buttonId ===
    "menu_language"
  ) {

    await sendLanguageMenu(
      from
    );

    return;
  }


  // =================================================
  // SCHEME BACK
  // =================================================

  if (
    buttonId ===
    "scheme_back"
  ) {

    await sendMainMenu(
      from
    );

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
  // LANGUAGE
  // =================================================

  if (
    listId ===
    "menu_language"
  ) {

    await sendLanguageMenu(
      from
    );

    return;
  }


  // =================================================
  // AI
  // =================================================

  if (
    listId ===
    "menu_ai"
  ) {

    users[from].mode =
      "ai";

    users[from].lastQuestion =
      "";


    await sendBackMessage(

      from,

      getText(
        from,
        "aiStart"
      )
    );


    return;
  }


  // =================================================
  // SCHEMES
  // =================================================

  if (
    listId ===
    "menu_schemes"
  ) {

    users[from].mode =
      "schemes";

    users[from].page =
      0;

    users[from].lastQuestion =
      "";


    await sendSchemeList(
      from
    );


    return;
  }


  // =================================================
  // APPLY
  // =================================================

  if (
    listId ===
    "menu_apply"
  ) {

    users[from].mode =
      "apply";

    users[from].lastQuestion =
      "";


    await sendBackMessage(

      from,

      getText(
        from,
        "applyStart"
      )
    );


    return;
  }


  // =================================================
  // DOCUMENTS
  // =================================================

  if (
    listId ===
    "menu_documents"
  ) {

    users[from].mode =
      "documents";

    users[from].lastQuestion =
      "";


    await sendBackMessage(

      from,

      getText(
        from,
        "documentsStart"
      )
    );


    return;
  }


  // =================================================
  // BACK
  // =================================================

  if (
    listId ===
    "back_menu"
  ) {

    await sendMainMenu(
      from
    );

    return;
  }


  // =================================================
  // SCHEME
  // =================================================

  if (
    listId.startsWith(
      "scheme_"
    )
  ) {

    const schemeId =
      listId.replace(
        "scheme_",
        ""
      );


    // NEXT
    if (
      schemeId ===
      "next"
    ) {

      users[from].page++;


      await sendSchemeList(
        from
      );


      return;
    }


    // PREVIOUS
    if (
      schemeId ===
      "previous"
    ) {

      users[from].page =
        Math.max(
          0,
          users[from].page - 1
        );


      await sendSchemeList(
        from
      );


      return;
    }


    // BACK
    if (
      schemeId ===
      "back"
    ) {

      await sendMainMenu(
        from
      );


      return;
    }


    // =================================================
    // GET SELECTED SCHEME
    // =================================================

    const schemes =
      await getSchemes();


    const scheme =
      schemes.find(
        item =>
          item.id ===
          schemeId
      );


    if (scheme) {

      await sendSchemeDetails(
        from,
        scheme
      );

    } else {

      await sendBackMessage(

        from,

        getText(
          from,
          "schemeNotFound"
        )
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


  if (
    !cleanQuestion
  ) {

    await sendBackMessage(

      from,

      getText(
        from,
        "emptyQuestion"
      )
    );


    return;
  }


  // =================================================
  // IMPORTANT:
  // Do NOT block repeated questions.
  //
  // User may ask same question again after
  // correcting / changing context.
  // =================================================


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


  // =================================================
  // ANSWER + BACK BUTTON
  // =================================================

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


    // =================================================
    // LANGUAGE
    // =================================================

    let languageInstruction =
      "";


    if (
      language === "hi"
    ) {

      languageInstruction =
        "Reply ONLY in simple Hindi using Devanagari script.";

    }

    else if (
      language === "en"
    ) {

      languageInstruction =
        "Reply ONLY in simple English.";

    }

    else {

      languageInstruction =
        "Reply ONLY in simple Hinglish using Roman Hindi. Do not use Devanagari unless absolutely necessary.";
    }


    // =================================================
    // GOOGLE SHEET
    // =================================================
    //
    // VERY IMPORTANT:
    //
    // Sheet is loaded ONLY for:
    //
    // mode === "schemes"
    //
    // AI / APPLY / DOCUMENTS:
    // NO SHEET
    //
    // =================================================

    let schemeContext =
      "";


    if (
      mode === "schemes"
    ) {

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


      schemeContext =
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
          .join(
            "\n\n"
          );
    }


    // =================================================
    // MODE RULES
    // =================================================

    let modeInstruction =
      "";


    // =================================================
    // AI MODE
    // =================================================

    if (
      mode === "ai"
    ) {

      modeInstruction = `
MODE: AI HELP

You are in general AI Help mode.

Answer the citizen's question directly and helpfully.

You may answer:
- General questions
- Education questions
- Government-related questions
- Everyday information
- Explanations

Do NOT use Google Sheet data in this mode.

Do NOT pretend to be a government officer.

Do NOT claim that JanSevak can approve applications.

If the question is about a government scheme,
give a useful answer using your knowledge.

If an exact government fact is uncertain,
do not invent it.
`;
    }


    // =================================================
    // SCHEMES MODE
    // =================================================

    if (
      mode === "schemes"
    ) {

      modeInstruction = `
MODE: GOVERNMENT SCHEMES

This mode is connected to JanSevak's Google Sheet.

Use the provided Google Sheet data as the PRIMARY
source for scheme information.

The citizen may ask about:

- Scheme name
- Who is eligible
- Benefits
- Amount
- Purpose
- Category
- Basic scheme information
- Other information present in the provided data

Use ONLY the provided scheme data when answering
specific scheme facts.

Never invent:
- Scheme names
- Benefits
- Amounts
- Eligibility
- Official sources

If a particular field is missing from the Sheet,
say that the specific information is not available
in JanSevak's scheme database.

Do not invent missing information.

If the citizen asks a general practical question about
the selected scheme and the answer is not present in
the Sheet, provide a useful answer only when it is
safe and clearly known.

Do not claim JanSevak is a government department.
`;
    }


    // =================================================
    // APPLY MODE
    // =================================================

    if (
      mode === "apply"
    ) {

      modeInstruction = `
MODE: APPLY GUIDE

IMPORTANT:

Google Sheet MUST NOT be used in this mode.

Answer using Gemini's own knowledge.

The citizen wants practical information about applying
for a government scheme or government service.

Answer directly and usefully.

Explain when relevant:

- How to apply
- Online or offline process
- Basic application steps
- Where the application is normally submitted
- What information may be required
- Common application procedure
- What happens after applying
- Possible verification steps

Do NOT simply say:
"Visit the government website."

Give the useful answer first.

Do NOT invent:
- Website URLs
- Application portals
- Fees
- Deadlines
- Official procedures

If an exact official detail is uncertain,
clearly say that the exact detail should be verified.

But still provide all useful information you know.
`;
    }


    // =================================================
    // DOCUMENTS MODE
    // =================================================

    if (
      mode === "documents"
    ) {

      modeInstruction = `
MODE: DOCUMENTS

IMPORTANT:

Google Sheet MUST NOT be used in this mode.

Answer using Gemini's own knowledge.

The citizen wants to know which documents are required
for a government scheme or service.

If the citizen clearly mentions a scheme,
answer directly with the relevant document list.

Possible document types may include:

- Aadhaar Card
- Bank Passbook
- Mobile Number
- PAN Card
- Residence Certificate
- Income Certificate
- Caste Certificate
- Land Documents
- Passport-size Photograph
- Ration Card
- Job Card
- Student Certificate
- Disability Certificate
- Other relevant documents

IMPORTANT:

Only list documents that are actually relevant to
the specific scheme.

Do NOT randomly list every document.

Do NOT invent documents.

Do NOT say:
"I don't know the documents."

Do NOT make the citizen go to the government website
as the only answer.

Give the useful document list directly.

If the exact document requirement is uncertain,
clearly mark that the exact requirement may vary and
should be verified.

If the citizen asks:
"documents?"
after already mentioning a scheme,
understand that the question refers to that scheme.
`;
    }


    // =================================================
    // UNIVERSAL PRACTICAL SCHEME RULES
    // =================================================

    const universalRules = `
PRACTICAL GOVERNMENT SCHEME RULES:

When the citizen asks about a government scheme,
understand the practical intent of the question.

The citizen may ask about:

1. DOCUMENTS
   - Tell the relevant documents clearly.
   - Do not randomly invent documents.

2. BENEFITS
   - Explain what benefit the citizen can receive.
   - If a known financial amount is available, mention it.
   - Never invent an amount.

3. ELIGIBILITY
   - Explain relevant conditions such as:
     age, gender, income, occupation, category,
     state, land ownership, student status,
     family status and other conditions.
   - Never invent eligibility criteria.

4. COST / FEES
   - If an official/application fee is known, mention it.
   - If exact fee is unknown, do not make up a number.
   - If giving an estimate, clearly label it as APPROXIMATE.
   - Never present an estimate as an official fee.

5. APPLICATION
   - Explain the process clearly.
   - Do not leave the citizen with only "visit website".

6. DEADLINE
   - Give the deadline only if known.
   - Never invent a date.

7. FOLLOW-UP QUESTIONS
   If the citizen previously mentioned a scheme and then
   asks something short like:
   "documents?"
   "benefit kya hai?"
   "eligible hoon?"
   "kitna paisa lagega?"
   "apply kaise hoga?"
   understand the question in the context of that
   previous scheme whenever the conversation context
   makes it clear.

8. MISSING INFORMATION
   If one exact detail is unavailable:
   - Give all useful information that IS available.
   - Mention only the missing detail.
   - Do not stop the entire answer.

9. NO FAKE INFORMATION
   Never invent:
   - Documents
   - Benefits
   - Amounts
   - Eligibility
   - Fees
   - Deadlines
   - Websites
   - Government rules
`;


    // =================================================
    // PROMPT
    // =================================================

    const prompt = `
You are "JanSevak AI", a friendly citizen-support
assistant for India.

${languageInstruction}

${modeInstruction}

${universalRules}

GENERAL RESPONSE RULES:

1. Answer the citizen directly.
2. Keep WhatsApp answers clear and reasonably short.
3. Use headings and bullet points when useful.
4. Use useful emojis when appropriate.
5. Be friendly and respectful.
6. Never claim to be a government officer.
7. Never claim JanSevak can approve an application.
8. Never invent government information.
9. Do not unnecessarily tell the citizen to visit a
   government website.
10. If exact information is unavailable, provide all
    useful information you do know.
11. Do not include a Back button in your text.
    The WhatsApp bot adds the Back button automatically.
12. Follow the selected language strictly.

${mode === "schemes"
  ? `
AVAILABLE GOOGLE SHEET SCHEME DATA:

${schemeContext ||
  "No scheme data is currently available."}
`
  : `
GOOGLE SHEET:

DO NOT USE GOOGLE SHEET DATA IN THIS MODE.
`
}

CURRENT USER QUESTION:

${question}
`;


    console.log(
      `Gemini request | mode=${mode} | model=${GEMINI_MODEL} | question=${question}`
    );


    // =================================================
    // GEMINI REQUEST WITH EXPONENTIAL BACKOFF
    // =================================================

    let response = null;

    let lastError = null;


    const MAX_RETRIES =
      4;


    for (
      let attempt = 0;
      attempt < MAX_RETRIES;
      attempt++
    ) {

      try {

        response =
          await ai.models.generateContent({

            model:
              GEMINI_MODEL,

            contents:
              prompt
          });


        if (response) {
          break;
        }

      } catch (error) {

        lastError =
          error;


        const status =
          error?.status ||
          error?.error?.code;


        const isRetryable =
          status === 503 ||
          status === 429 ||
          status === 408 ||
          status === 500 ||
          status === 502 ||
          status === 504;


        console.error(
          `Gemini attempt ${
            attempt + 1
          }/${MAX_RETRIES} failed:`,
          error?.message ||
          error
        );


        // Don't retry permanent errors
        if (
          !isRetryable
        ) {

          throw error;
        }


        // Last attempt
        if (
          attempt ===
          MAX_RETRIES - 1
        ) {

          break;
        }


        // 2s, 4s, 8s + random jitter
        const baseDelay =
          2000 *
          Math.pow(
            2,
            attempt
          );


        const jitter =
          Math.floor(
            Math.random() *
            1000
          );


        const delay =
          baseDelay +
          jitter;


        console.log(
          `Gemini retrying in ${delay}ms...`
        );


        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              delay
            )
        );
      }
    }


    // =================================================
    // IF ALL RETRIES FAILED
    // =================================================

    if (!response) {

      console.error(
        "Gemini final error:",
        lastError
      );


      return getText(
        from,
        "aiUnavailable"
      );
    }


    // =================================================
    // RESPONSE TEXT
    // =================================================

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
//
// IMPORTANT:
//
// This function is ONLY called from scheme-related
// operations.
//
// AI / APPLY / DOCUMENTS do not call it.
//
// =====================================================

async function getSchemes() {

  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;


  const response =
    await fetch(url);


  if (
    !response.ok
  ) {

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
    json.table?.rows ||
    [];


  const schemes = [];


  rows.forEach(
    row => {

      const id =
        row.c?.[0]?.v;


      const name =
        row.c?.[1]?.v;


      if (
        !id ||
        !name
      ) {

        return;
      }


      if (
        String(id)
          .trim()
          .toLowerCase() ===
        "id"
      ) {

        return;
      }


      schemes.push({

        id:
          String(id)
            .trim(),

        name:
          String(name)
            .trim(),

        category:
          row.c?.[2]?.v
            ? String(
                row.c[2].v
              ).trim()
            : "Not Available",

        who:
          row.c?.[3]?.v
            ? String(
                row.c[3].v
              ).trim()
            : "Not Available",

        benefit:
          row.c?.[4]?.v
            ? String(
                row.c[4].v
              ).trim()
            : "Not Available",

        source:
          row.c?.[5]?.v
            ? String(
                row.c[5].v
              ).trim()
            : "Not Available"
      });
    }
  );


  return schemes;
}


// =====================================================
// SCHEME LIST
// =====================================================

async function sendSchemeList(
  to
) {

  try {

    const schemes =
      await getSchemes();


    if (
      !schemes.length
    ) {

      await sendBackMessage(
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


    // =================================================
    // WhatsApp list max = 10 rows
    //
    // Reserve 2 rows for Previous/Next/Back.
    //
    // Use 8 schemes per page.
    // =================================================

    const perPage =
      8;


    const totalPages =
      Math.ceil(
        schemes.length /
        perPage
      );


    let page =
      users[to]?.page ||
      0;


    if (
      page < 0
    ) {

      page = 0;
    }


    if (
      page >= totalPages
    ) {

      page =
        totalPages - 1;
    }


    users[to].page =
      page;


    const start =
      page *
      perPage;


    const currentSchemes =
      schemes.slice(
        start,
        start + perPage
      );


    let body = "";


    // =================================================
    // HINDI
    // =================================================

    if (
      language === "hi"
    ) {

      body =
`📋 *सरकारी योजनाएँ*

नीचे से योजना चुनें 👇

📄 पेज ${page + 1} / ${totalPages}`;
    }


    // =================================================
    // ENGLISH
    // =================================================

    else if (
      language === "en"
    ) {

      body =
`📋 *Government Schemes*

Select a scheme below 👇

📄 Page ${page + 1} / ${totalPages}`;
    }


    // =================================================
    // HINGLISH
    // =================================================

    else {

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
              .substring(
                0,
                24
              ),

          description:
            `${scheme.category}`
              .substring(
                0,
                72
              )
        })
      );


    // =================================================
    // PREVIOUS
    // =================================================

    if (
      page > 0
    ) {

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


    // =================================================
    // NEXT
    // =================================================

    if (
      page <
      totalPages - 1
    ) {

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


    // =================================================
    // BACK
    // =================================================

    rows.push({

      id:
        "scheme_back",

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

  } catch (error) {

    console.error(
      "Scheme list error:",
      error
    );


    await sendBackMessage(
      to,
      getText(
        to,
        "sheetUnavailable"
      )
    );
  }
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


  let message =
    "";


  // =================================================
  // HINDI
  // =================================================

  if (
    language === "hi"
  ) {

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
  }


  // =================================================
  // ENGLISH
  // =================================================

  else if (
    language === "en"
  ) {

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
  }


  // =================================================
  // HINGLISH
  // =================================================

  else {

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


  // =================================================
  // SEND ANSWER
  // =================================================

  await sendTextMessage(
    to,
    message
  );


  // =================================================
  // BACK BUTTON
  // =================================================

  await sendButtonMessage(

    to,

    language === "hi"
      ? "👇 मुख्य मेनू पर वापस जाएँ"
      : language === "en"
      ? "👇 Return to main menu"
      : "👇 Main menu par wapas jayein",

    [

      {
        id:
          "back_menu",

        title:
          language === "hi"
            ? "⬅️ वापस"
            : "⬅️ Back"
      }

    ]
  );
}


// =====================================================
// SEND ANSWER + BACK BUTTON
// =====================================================

async function sendBackMessage(
  to,
  message
) {

  const language =
    users[to]?.language ||
    "hinglish";


  // =================================================
  // ANSWER
  // =================================================

  await sendTextMessage(
    to,
    message
  );


  // =================================================
  // BACK BUTTON
  // =================================================

  await sendButtonMessage(

    to,

    language === "hi"
      ? "👇 मुख्य मेनू पर वापस जाएँ"
      : language === "en"
      ? "👇 Return to main menu"
      : "👇 Main menu par wapas jayein",

    [

      {
        id:
          "back_menu",

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
                  String(body)
                    .substring(
                      0,
                      1024
                    )
              },

              action: {

                buttons:
                  buttons
                    .slice(
                      0,
                      3
                    )
                    .map(
                      button => ({

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

आप मुझसे सामान्य सवाल, पढ़ाई, सरकारी योजनाओं और दूसरी जानकारी से जुड़े सवाल पूछ सकते हैं।

👇 अपना सवाल भेजें।`,

      en:
`🤖 *AI Help*

Hello! 😊

You can ask me general questions, study questions, government scheme questions and other useful questions.

👇 Send your question.`,

      hinglish:
`🤖 *AI Help*

Hello! 😊

Aap mujhse general questions, padhai, government schemes aur doosri useful information ke baare mein pooch sakte hain.

👇 Apna question bhejein.`
    },


    // =================================================
    // APPLY
    // =================================================

    applyStart: {

      hi:
`📝 *आवेदन गाइड*

मैं आपको सरकारी योजना या सरकारी सेवा के लिए आवेदन करने की प्रक्रिया समझाने में मदद करूँगा।

आप पूछ सकते हैं:

• इस योजना के लिए आवेदन कैसे करें?
• Online apply कैसे करें?
• Offline apply कैसे करें?
• Application process क्या है?
• आवेदन में क्या-क्या जानकारी चाहिए?

👇 अपनी योजना या सेवा का नाम और सवाल भेजें।`,

      en:
`📝 *Apply Guide*

I can help you understand how to apply for a government scheme or service.

You can ask:

• How do I apply?
• How can I apply online?
• How can I apply offline?
• What is the application process?
• What information is required?

👇 Send the scheme/service name and your question.`,

      hinglish:
`📝 *Apply Guide*

Main aapko government scheme ya service ke liye apply karne ka process samjhaunga.

Aap pooch sakte hain:

• Is scheme ke liye apply kaise karein?
• Online apply kaise hoga?
• Offline apply kaise hoga?
• Application process kya hai?
• Kya information chahiye?

👇 Scheme/service ka naam aur apna question bhejein.`
    },


    // =================================================
    // DOCUMENTS
    // =================================================

    documentsStart: {

      hi:
`📄 *दस्तावेज़*

मैं आपको योजना के लिए जरूरी documents की जानकारी दूँगा।

आप पूछ सकते हैं:

• इस योजना में कौन-कौन से documents चाहिए?
• कौन सा certificate चाहिए?
• Aadhaar जरूरी है?
• Bank passbook चाहिए?

👇 योजना का नाम और अपना सवाल भेजें।`,

      en:
`📄 *Documents*

I can help you understand which documents may be required for a government scheme.

You can ask:

• Which documents are required?
• Which certificate is needed?
• Is Aadhaar required?
• Is a bank passbook required?

👇 Send the scheme name and your question.`,

      hinglish:
`📄 *Documents*

Main aapko scheme ke liye required documents ke baare mein direct information dunga.

Aap pooch sakte hain:

• Is scheme mein kaun-kaun se documents chahiye?
• Kaunsa certificate chahiye?
• Aadhaar zaroori hai?
• Bank passbook chahiye?

👇 Scheme ka naam aur apna question bhejein.`
    },


    // =================================================
    // SCHEME NOT FOUND
    // =================================================

    schemeNotFound: {

      hi:
`❌ माफ कीजिए, यह योजना नहीं मिली।

उदाहरण:
JH-001`,

      en:
`❌ Sorry, this scheme was not found.

Example:
JH-001`,

      hinglish:
`❌ Sorry, ye scheme nahi mili.

Example:
JH-001`
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
    // SHEET ERROR
    // =================================================

    sheetUnavailable: {

      hi:
        "⚠️ योजनाओं का database अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद दोबारा प्रयास करें।",

      en:
        "⚠️ The scheme database is currently unavailable. Please try again later.",

      hinglish:
        "⚠️ Scheme database abhi available nahi hai. Thodi der baad dobara try karein."
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
    // EMPTY QUESTION
    // =================================================

    emptyQuestion: {

      hi:
        "🙂 कृपया अपना सवाल लिखकर भेजें।",

      en:
        "🙂 Please type and send your question.",

      hinglish:
        "🙂 Please apna question type karke bhejein."
    },


    // =================================================
    // AI ERROR
    // =================================================

    aiUnavailable: {

      hi:
        "⚠️ AI सेवा इस समय व्यस्त है। मैंने दोबारा कोशिश की लेकिन अभी जवाब नहीं मिल पाया। कृपया कुछ देर बाद फिर से सवाल भेजें।",

      en:
        "⚠️ The AI service is currently busy. I retried the request but could not get a response. Please send your question again after a short while.",

      hinglish:
        "⚠️ AI service abhi busy hai. Maine retry kiya lekin response nahi mil paya. Thodi der baad question dobara bhejein."
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

      model:
        GEMINI_MODEL,

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
