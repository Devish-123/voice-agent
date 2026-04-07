require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");

const app = express();

// ✅ Middleware (IMPORTANT for Exotel)
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ✅ OpenAI setup
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Root route (for testing)
app.get("/", (req, res) => {
    res.send("Voice AI Agent Running 🚀");
});

// 🔥 STEP 1: Incoming Call (Exotel hits this)
app.post("/voice", (req, res) => {
    res.set("Content-Type", "text/xml");

    // ✅ IMPORTANT: Use full URL in production
    const baseUrl = process.env.BASE_URL;

    res.send(`
<Response>
  <Say>Welcome to our hotel. How can I help you today?</Say>
  <GetInput action="${baseUrl}/process" method="POST" input="speech"></GetInput>
</Response>
  `);
});

// 🔥 STEP 2: Process User Speech
app.post("/process", async (req, res) => {
    res.set("Content-Type", "text/xml");

    try {
        const userSpeech = req.body.SpeechResult || "";

        console.log("🗣 User said:", userSpeech);

        if (!userSpeech) {
            return res.send(`
<Response>
  <Say>I didn't catch that. Could you please repeat?</Say>
  <GetInput action="${process.env.BASE_URL}/process" method="POST" input="speech"></GetInput>
</Response>
      `);
        }

        // 🔥 INTENT DETECTION (LLM-based)
        const intentRes = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `
Classify the intent of the user.

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

        console.log("🎯 Detected intent:", intent);

        // 🔴 ESCALATION LOGIC
        if (intent === "BOOKING" || intent === "DISCOUNT") {
            return res.send(`
<Response>
  <Say>Please wait while I connect you to our staff.</Say>
  <Dial>+919966647375</Dial>
</Response>
      `);
        }

        // 🤖 AI RESPONSE
        let reply = "Sorry, I couldn't process that.";

        try {
            const aiResponse = await openai.chat.completions.create({
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

            reply = aiResponse.choices[0].message.content;
        } catch (err) {
            console.error("❌ OpenAI error:", err);
            reply = "Sorry, let me connect you to our staff.";
        }

        // 🔁 CONTINUE CONVERSATION
        res.send(`
<Response>
  <Say>${reply}</Say>
  <GetInput action="${process.env.BASE_URL}/process" method="POST" input="speech"></GetInput>
</Response>
    `);

    } catch (err) {
        console.error("❌ Server error:", err);

        res.send(`
<Response>
  <Say>Something went wrong. Please hold while we connect you.</Say>
  <Dial>+919966647375</Dial>
</Response>
    `);
    }
});

// ✅ Start server (Railway compatible)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});