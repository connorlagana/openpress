/** Per-client MCP setup instructions. Client UIs change often; keep these short and generic. */
export function clientInstructions(mcpUrl: string, appName: string) {
  const id = appName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return [
    {
      id: "claude",
      name: "Claude",
      steps: [
        "Open Claude (web or desktop) → Settings → Connectors.",
        "Choose “Add custom connector”, name it and paste the URL below.",
        `Click Connect and approve access on the ${appName} consent screen.`,
      ],
      code: mcpUrl,
    },
    {
      id: "chatgpt",
      name: "ChatGPT",
      steps: [
        "Open ChatGPT → Settings → Apps & Connectors (enable developer mode under Advanced if custom connectors are hidden).",
        "Create a connector, paste the URL below and choose OAuth authentication.",
        `Approve access on the ${appName} consent screen, then enable the connector in a chat.`,
      ],
      code: mcpUrl,
    },
    {
      id: "claude-code",
      name: "Claude Code",
      steps: ["Run this in your terminal, then run /mcp inside Claude Code to sign in."],
      code: `claude mcp add --transport http ${id} ${mcpUrl}`,
    },
    {
      id: "cursor",
      name: "Cursor",
      steps: ["Add this to ~/.cursor/mcp.json (or .cursor/mcp.json in a project). Cursor opens the sign-in page on first use."],
      code: JSON.stringify({ mcpServers: { [id]: { url: mcpUrl } } }, null, 2),
    },
    {
      id: "vscode",
      name: "VS Code",
      steps: ["Add this to .vscode/mcp.json, then start the server from the MCP view and sign in."],
      code: JSON.stringify({ servers: { [id]: { type: "http", url: mcpUrl } } }, null, 2),
    },
    {
      id: "other",
      name: "Other / API key",
      steps: [
        "Any client supporting Streamable HTTP and OAuth 2.1 (dynamic client registration + PKCE) can use the URL directly.",
        "For clients without OAuth, create an API key below and send it as a bearer token.",
      ],
      code: `URL:     ${mcpUrl}\nHeader:  Authorization: Bearer fol_key_…`,
    },
  ];
}
