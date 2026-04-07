require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");

const app = express();

// ✅ Middleware (VERY IMPORTANT)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Base URL fallback (IMPORTANT FIX)
const BASE_URL =
  process.env.BASE_URL || "https://voice-agent-nux8.onrender.com";

// ✅ Root route
app.get("/", (req, res) => {
  res.send("Voice AI Agent Running 🚀");
});

// 🔥 STEP 1: Incoming Call
app.post("/voice", (req, res) => {
  res.set("Content-Type", "text/xml");

  res.send(`
<Response>
  <Say>Please wait while I connect you.</Say>
  <Pause length="2"/>
  <Say>Welcome to our hotel. How can I help you today?</Say>
  <GetInput action="${BASE_URL}/process" method="POST" input="speech"></GetInput>
</Response>
  `);
});

// 🔥 STEP 2: Process Speech
app.post("/process", async (req, res) => {
  res.set("Content-Type", "text/xml");

  try {
    console.log("🔥 BODY RECEIVED:", req.body);

    // ✅ Robust speech extraction
    const userSpeech =
      req.body.SpeechResult ||
      req.body.speech ||
      req.body.text ||
      "";

    console.log("🗣 User said:", userSpeech);

    // ❌ If empty input
    if (!userSpeech || userSpeech.trim() === "") {
      return res.send(`
<Response>
  <Say>I didn't catch that. Could you please repeat?</Say>
  <GetInput action="${BASE_URL}/process" method="POST" input="speech"></GetInput>
</Response>
      `);
    }

    // 🔥 INTENT DETECTION (LLM)
    const intentRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Classify the user intent.

Return ONLY one word:
FAQ
BOOKING
DISCOUNT
OTHER
          `,
        },
        {
          role: "user",
          content: userSpeech,
        },
      ],
    });

    const intent = intentRes.choices[0].message.content.trim();
    console.log("🎯 Intent:", intent);

    // 🔴 ESCALATION
    if (intent === "BOOKING" || intent === "DISCOUNT") {
      return res.send(`
<Response>
  <Say>Please wait while I connect you to our staff.</Say>
  <Dial>+919966647375</Dial>
</Response>
      `);
    }

    // 🤖 AI RESPONSE
    let reply = "Sorry, something went wrong.";

    try {
      const aiRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a polite hotel receptionist.

Answer briefly and clearly.

Hotel details:
- Rooms start at 1500 rupees per night
- Free WiFi available
- Check-in: 12 PM
- Check-out: 11 AM
            `,
          },
          {
            role: "user",
            content: userSpeech,
          },
        ],
      });

      reply = aiRes.choices[0].message.content;
    } catch (err) {
      console.error("❌ OpenAI error:", err);
      reply = "Let me connect you to our staff.";
    }

    // 🔁 Continue conversation
    res.send(`
<Response>
  <Say>${reply}</Say>
  <GetInput action="${BASE_URL}/process" method="POST" input="speech"></GetInput>
</Response>
    `);

  } catch (err) {
    console.error("❌ Server error:", err);

    res.send(`
<Response>
  <Say>Something went wrong. Connecting you to staff.</Say>
  <Dial>+919966647375</Dial>
</Response>
    `);
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
