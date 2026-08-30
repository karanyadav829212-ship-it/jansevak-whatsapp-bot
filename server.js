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
  process.env.GEMINI_MODEL || "gemini-3.6-flash";

// =====================================================
// 3 LANGUAGE GOOGLE SHEETS
// =====================================================

const SHEET_NAME = "Sheet1";

const SHEETS = {
  en: "1GeXblMObkNM-KDmMhQPY4ZA8Gv180L_eqb7aNteDu88",
  hi: "1gNAmNZy3R_AS36E2v6hxosajGd32Typ1DrrDsTJJXFQ",
  hinglish: "1yMC6M0kdCmFUA8gplbOSxrYesoLLmfwfcTbcQx4Ldps"
};

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
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;

    createUser(from);

    // TEXT
    if (message.type === "text") {

      const text =
        message.text?.body?.trim() || "";

      await handleTextMessage(from, text);

      return res.sendStatus(200);

    }

    // BUTTON / LIST
    if (message.type === "interactive") {

      const interactive = message.interactive;

      if (interactive?.type === "button_reply") {

        await handleButton(
          from,
          interactive.button_reply.id
        );

        return res.sendStatus(200);

      }

      if (interactive?.type === "list_reply") {

        await handleListSelection(
          from,
          interactive.list_reply.id
        );

        return res.sendStatus(200);

      }

    }

    return res.sendStatus(200);

  } catch (err) {

    console.error("Webhook Error:", err);

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
// TEXT HANDLER
// =====================================================

async function handleTextMessage(from, originalText) {

  createUser(from);

  const rawText = originalText.trim();
  const text = rawText.toLowerCase();

  // THANK YOU
  if (isThankYou(text)) {
    await sendTextMessage(from, getText(from, "thankYou"));
    return;
  }

  // GREETING
  if (isGreeting(text)) {
    await sendLanguageMenu(from);
    return;
  }

  // LANGUAGE SELECT
  if (text === "1" || text === "hindi" || text === "हिंदी") {
    setLanguage(from, "hi");
    await sendMainMenu(from);
    return;
  }

  if (text === "2" || text === "english") {
    setLanguage(from, "en");
    await sendMainMenu(from);
    return;
  }

  if (
    text === "3" ||
    text === "hinglish" ||
    text === "higlish"
  ) {
    setLanguage(from, "hinglish");
    await sendMainMenu(from);
    return;
  }

  // BACK
  if (isBackCommand(text) || isHomeCommand(text)) {
    await sendMainMenu(from);
    return;
  }

  // LANGUAGE NOT SELECTED
  if (!users[from].language) {
    await sendLanguageMenu(from);
    return;
  }

  // AI MODE
  if (users[from].mode === "ai") {
    await processAIQuestion(from, rawText, "ai");
    return;
  }

  // SCHEMES MODE
  if (users[from].mode === "schemes") {
    await processAIQuestion(from, rawText, "schemes");
    return;
  }

  // APPLY MODE
  if (users[from].mode === "apply") {
    await processAIQuestion(from, rawText, "apply");
    return;
  }

  // DOCUMENT MODE
  if (users[from].mode === "documents") {
    await processAIQuestion(from, rawText, "documents");
    return;
  }

  await sendBackMessage(from, getText(from, "unknown"));
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
    "dhanyawad",
    "धन्यवाद",
    "shukriya"
  ];

  return words.includes(text);

}

// =====================================================
// BACK
// =====================================================

function isBackCommand(text) {

  return [
    "back",
    "wapas",
    "vapas",
    "पीछे",
    "वापस"
  ].includes(text);

}

function isHomeCommand(text) {

  return [
    "menu",
    "home",
    "main",
    "main menu"
  ].includes(text);

}

// =====================================================
// PROCESS AI QUESTION
// =====================================================

async function processAIQuestion(from, question, mode) {

  const answer =
    await askGemini(from, question, mode);

  users[from].lastQuestion = question;
  users[from].lastAnswer = answer;

  await sendBackMessage(from, answer);

} 
// =====================================================
// GET SCHEMES (AUTO LANGUAGE SHEET)
// =====================================================

async function getSchemes(language = "hinglish") {

  const sheetId = SHEETS[language] || SHEETS.hinglish;

  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

  const res = await fetch(url);

  const txt = await res.text();

  const json = JSON.parse(
    txt.substring(47).slice(0, -2)
  );

  const rows = json.table.rows || [];

  return rows
    .filter(r => r.c?.[0]?.v && r.c[0].v !== "ID")
    .map(r => ({
      id: r.c?.[0]?.v || "",
      name: r.c?.[1]?.v || "",
      category: r.c?.[2]?.v || "",
      who: r.c?.[3]?.v || "",
      benefit: r.c?.[4]?.v || "",
      documents: r.c?.[5]?.v || "",
      eligibility: r.c?.[6]?.v || "",
      application: r.c?.[7]?.v || "",
      fee: r.c?.[8]?.v || "",
      deadline: r.c?.[9]?.v || "",
      source: r.c?.[10]?.v || ""
    }));

}

// =====================================================
// GEMINI AI
// =====================================================

async function askGemini(from, question, mode) {

  try {

    if (!ai)
      return getText(from, "aiUnavailable");

    const language =
      users[from]?.language || "hinglish";

    const schemes =
      await getSchemes(language);

    const database =
      schemes.map(s => `
ID: ${s.id}
Name: ${s.name}
Category: ${s.category}
Who: ${s.who}
Benefit: ${s.benefit}
Documents: ${s.documents}
Eligibility: ${s.eligibility}
Application: ${s.application}
Fee: ${s.fee}
Deadline: ${s.deadline}
Source: ${s.source}
`).join("\n-----------------\n");

    let langRule = "";

    if (language === "hi") {
      langRule =
        "Reply ONLY in Hindi (Devanagari).";
    } else if (language === "en") {
      langRule =
        "Reply ONLY in English.";
    } else {
      langRule =
        "Reply ONLY in Hinglish (Roman Hindi).";
    }

    const prompt = `
You are JanSevak AI.

${langRule}

Citizen is asking about Government Schemes.

RULES:

- Answer directly.
- Never mention Google Sheet.
- Never say visit website unless information missing.
- Give Benefits.
- Give Documents.
- Give Eligibility.
- Give Apply Process.
- Give Fee.
- Give Deadline.
- Keep WhatsApp format.
- Do not invent fake data.

DATABASE:

${database}

QUESTION:

${question}
`;

    let response;

    for (let i = 0; i < 3; i++) {

      try {

        response =
          await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt
          });

        break;

      } catch (err) {

        if (err?.status === 503 && i < 2) {

          await new Promise(r =>
            setTimeout(r, 2000)
          );

          continue;
        }

        throw err;

      }

    }

    return (
      response?.text?.trim() ||
      getText(from, "aiUnavailable")
    );

  } catch (err) {

    console.log(err);

    return getText(from, "aiUnavailable");

  }

} 
// =====================================================
// LANGUAGE MENU
// =====================================================

async function sendLanguageMenu(to){

await sendButtonMessage(
to,
`👋 Welcome to JanSevak!

🌐 Please select your language`,
[
{id:"language_hindi",title:"🇮🇳 Hindi"},
{id:"language_english",title:"🇬🇧 English"},
{id:"language_hinglish",title:"😎 Hinglish"}
]
);

}

// =====================================================
// MAIN MENU
// =====================================================

async function sendMainMenu(to){

users[to].mode="menu";

const lang=users[to].language||"hinglish";

let body="";
let rows=[];

if(lang==="hi"){

body="👋 जनसेवक में आपका स्वागत है";

rows=[
{id:"menu_ai",title:"🤖 AI Help"},
{id:"menu_schemes",title:"📋 योजनाएँ"},
{id:"menu_apply",title:"📝 आवेदन"},
{id:"menu_documents",title:"📄 दस्तावेज़"}
];

}

else if(lang==="en"){

body="👋 Welcome to JanSevak";

rows=[
{id:"menu_ai",title:"🤖 AI Help"},
{id:"menu_schemes",title:"📋 Schemes"},
{id:"menu_apply",title:"📝 Apply"},
{id:"menu_documents",title:"📄 Documents"}
];

}

else{

body="👋 JanSevak me welcome!";

rows=[
{id:"menu_ai",title:"🤖 AI Help"},
{id:"menu_schemes",title:"📋 Schemes"},
{id:"menu_apply",title:"📝 Apply"},
{id:"menu_documents",title:"📄 Documents"}
];

}

await sendListMessage(
to,
body,
"Open",
rows
);

}

// =====================================================
// BUTTON
// =====================================================

async function handleButton(from,id){

if(id==="language_hindi"){
setLanguage(from,"hi");
return sendMainMenu(from);
}

if(id==="language_english"){
setLanguage(from,"en");
return sendMainMenu(from);
}

if(id==="language_hinglish"){
setLanguage(from,"hinglish");
return sendMainMenu(from);
}

if(id==="back_menu"){
return sendMainMenu(from);
}

}

// =====================================================
// LIST
// =====================================================

async function handleListSelection(from,id){

if(id==="menu_ai"){

users[from].mode="ai";

return sendBackMessage(
from,
"🤖 AI Help Start\n\nApna question bhejiye."
);

}

if(id==="menu_schemes"){

users[from].mode="schemes";

return sendBackMessage(
from,
"📋 Scheme ka naam bhejiye."
);

}

if(id==="menu_apply"){

users[from].mode="apply";

return sendBackMessage(
from,
"📝 Kis scheme me apply karna hai?"
);

}

if(id==="menu_documents"){

users[from].mode="documents";

return sendBackMessage(
from,
"📄 Kis scheme ke documents chahiye?"
);

}

}

// =====================================================
// BACK BUTTON
// =====================================================

async function sendBackMessage(to,msg){

await sendTextMessage(to,msg);

await sendButtonMessage(
to,
"👇 Main Menu",
[
{id:"back_menu",title:"⬅️ Back"}
]
);

}

// =====================================================
// TEXT
// =====================================================

async function sendTextMessage(to,body){

await fetch(
`https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
{
method:"POST",
headers:{
Authorization:`Bearer ${WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body:JSON.stringify({
messaging_product:"whatsapp",
to,
type:"text",
text:{body}
})
}
);

}

// =====================================================
// BUTTON MESSAGE
// =====================================================

async function sendButtonMessage(to,body,buttons){

await fetch(
`https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
{
method:"POST",
headers:{
Authorization:`Bearer ${WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body:JSON.stringify({
messaging_product:"whatsapp",
to,
type:"interactive",
interactive:{
type:"button",
body:{text:body},
action:{
buttons:buttons.map(b=>({
type:"reply",
reply:{
id:b.id,
title:b.title
}
}))
}
}
})
}
);

}

// =====================================================
// LIST MESSAGE
// =====================================================

async function sendListMessage(to,body,btn,rows){

await fetch(
`https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
{
method:"POST",
headers:{
Authorization:`Bearer ${WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body:JSON.stringify({
messaging_product:"whatsapp",
to,
type:"interactive",
interactive:{
type:"list",
body:{text:body},
action:{
button:btn,
sections:[
{
title:"JanSevak",
rows
}
]
}
}
})
}
);

}

// =====================================================
// TEXTS
// =====================================================

function getText(from,key){

const lang=users[from]?.language||"hinglish";

const t={

thankYou:{
hi:"😊 धन्यवाद",
en:"😊 Thank You",
hinglish:"😊 Shukriya"
},

unknown:{
hi:"समझ नहीं आया",
en:"I didn't understand.",
hinglish:"Samajh nahi aaya."
},

aiUnavailable:{
hi:"AI उपलब्ध नहीं है",
en:"AI unavailable",
hinglish:"AI abhi unavailable hai"
}

};

return t[key]?.[lang]||"OK";

}

// =====================================================
// HEALTH
// =====================================================

app.get("/",(req,res)=>{
res.send("🇮🇳 JanSevak Running");
});

app.get("/health",(req,res)=>{
res.json({
status:"ok",
model:GEMINI_MODEL
});
});

// =====================================================
// START
// =====================================================

app.listen(PORT,()=>{

console.log(
`JanSevak running on ${PORT}`
);

});
