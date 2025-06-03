const readline = require("readline/promises");
const { GoogleGenAI } = require("@google/genai");
const { text } = require("stream/consumers");
require("dotenv").config();

const chatHistory = [];
const r1 = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function chatLoop() {
  const question = await r1.question("You: ");

  chatHistory.push({
    role: "user",
    parts: [
      {
        text: question,
        type: "text",
      },
    ],
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-001",
    contents: chatHistory,
  });

  const responseText = response.candidates[0].content.parts[0].text;

  chatHistory.push({
    role: "model",
    parts: [
      {
        text: responseText,
        type: "text",
      },
    ],
  });

  console.log(`AI: ${responseText}`);

  chatLoop();
}

chatLoop();
