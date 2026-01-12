# MCP Client Configurations

Connect your MCP server to AI assistants and development tools.

## Claude Desktop

Claude Desktop supports MCP servers via the configuration file.

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "my-site": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.example.com/sse"]
    }
  }
}
```

Replace `mcp.example.com` with your MCP server domain.

**Restart Claude Desktop** after editing the config.

## Claude Code (CLI)

Add using the CLI:

```bash
claude mcp add my-site --transport sse https://mcp.example.com/sse
```

Or edit `~/.claude/settings.local.json` directly:

```json
{
  "mcpServers": {
    "my-site": {
      "type": "sse",
      "url": "https://mcp.example.com/sse"
    }
  }
}
```

**Restart Claude Code** after adding the server.

## Cursor

Add to your Cursor MCP settings file:

```json
{
  "mcpServers": {
    "my-site": {
      "url": "https://mcp.example.com/sse"
    }
  }
}
```

## Windsurf

Add to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "my-site": {
      "serverUrl": "https://mcp.example.com/sse"
    }
  }
}
```

## Multiple MCP Servers

You can connect multiple MCP servers. Each appears as a separate set of tools:

```json
{
  "mcpServers": {
    "docs": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://docs-mcp.example.com/sse"]
    },
    "blog": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://blog-mcp.example.com/sse"]
    }
  }
}
```

Tools will be named based on each server's `toolPrefix`:
- `search_docs`, `search_blog`
- `get_article` (shared name, context determines which)
- `get_index_info` (same)

## Verifying Connection

Once connected, ask the AI assistant:

> "What tools do you have for searching my-site?"

It should respond with the available tools:
- `search_<prefix>` — Search content by keywords
- `get_article` — Get full article content
- `get_index_info` — Index statistics

## Transport Options

The MCP server supports two transport protocols:

| Endpoint | Protocol | Compatibility |
|----------|----------|---------------|
| `/sse` | Server-Sent Events | Claude Desktop, most clients |
| `/mcp` | Streamable HTTP | Newer MCP clients |

Most clients should use `/sse`. The `/mcp` endpoint is for clients that specifically support the newer streamable HTTP transport.

## Troubleshooting

### "MCP server not found" or similar

1. Check the URL is correct and includes `/sse`
2. Verify the server is deployed: `curl https://mcp.example.com/`
3. Restart the MCP client after config changes

### Tools not appearing

1. Wait a few seconds after connecting
2. Check the index has content: ask "Get index info for my-site"
3. Verify the search index is uploaded to R2

### Connection timeouts

1. Check your Cloudflare Worker is deployed
2. Verify custom domain DNS is configured
3. Try the workers.dev URL instead of custom domain
