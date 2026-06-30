import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export async function createMcpConnection(): Promise<Client | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;

  if (!clientId || !clientSecret || !spreadsheetId) {
    console.warn("Google Workspace MCP configuration missing (.env.local). Operating in local MOCK mode.");
    return null;
  }

  try {
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-google-workspace"],
      env: {
        GOOGLE_OAUTH_CLIENT_ID: clientId,
        GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
        GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth/callback",
        SHEETS_SPREADSHEET_ID: spreadsheetId,
        // Carry over PATH and HOME so npx/node can resolve properly in the subprocess env
        PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
        HOME: process.env.HOME || "",
      }
    });

    const client = new Client({
      name: "meetingmind-orchestrator",
      version: "1.0.0"
    }, {
      capabilities: {}
    });

    console.info("Connecting to Google Workspace MCP Server subprocess...");
    await client.connect(transport);
    console.info("Google Workspace MCP Connected successfully.");
    return client;
  } catch (error) {
    console.error("Failed to connect to Google Workspace MCP Server:", error);
    console.warn("Gracefully falling back to local MOCK mode.");
    return null;
  }
}
