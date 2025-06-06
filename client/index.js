import readline from "readline/promises";
import { GoogleGenAI, mcpToTool } from "@google/genai";
import { text } from "stream/consumers";
import { config } from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

config({ path: "../.env" });

const chatHistory = [];
let tools = [];

const r1 = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const mcpClient = new Client({
  name: "streamable-http-client",
  version: "1.0.0",
});

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp")
);

await mcpClient.connect(transport).then(async () => {
  console.log("Connected using Streamable HTTP transport");

  tools = (await mcpClient.listTools()).tools.map((tool) => {
    return {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: tool.inputSchema.type,
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required,
      },
    };
  });

  await chatLoop();
});

// await mcpClient.connect(transport).then(async () => {
//   console.log("Connected using Streamable HTTP transport");

//   await chatLoop();
// });

async function chatLoop(toolCall) {
  if (toolCall) {
    console.log("Calling tool: ", toolCall.name);

    chatHistory.push({
      role: "model",
      parts: [
        {
          text: `Calling tool: ${toolCall.name}`,
          type: "text",
        },
      ],
    });

    const toolResult = await mcpClient.callTool({
      name: toolCall.name,
      arguments: toolCall.args,
    });

    chatHistory.push({
      role: "user",
      parts: [
        {
          text: "Tool result is: " + toolResult.content[0].text,
          type: "text",
        },
      ],
    });
  } else {
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
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: chatHistory,
    //Build-in MCP support is experimental feature , which might break later
    // config: {
    //   tools: [mcpToTool(mcpClient)],
    // },
    config: {
      tools: [{ functionDeclarations: tools }],
    },
  });

  const responseText = response.text;
  const functionCall = response.candidates[0].content.parts[0].functionCall;

  if (functionCall) {
    return chatLoop(functionCall);
  }

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
