# Cloudflare MCP Server for Static Sites

Make your static website searchable by AI assistants. This project deploys a [Cloudflare Worker](https://developers.cloudflare.com/agents/model-context-protocol/) that implements the [Model Context Protocol](https://modelcontextprotocol.io) (MCP). AI tools like Claude can then search and retrieve your content directly.

Cloudflare is [well-suited for hosting remote MCP servers](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/) — its Workers platform handles the transport layer, and Durable Objects maintain persistent client sessions.

## Why This Matters

AI assistants answer questions based on their training data, which may be outdated or incomplete. They can't search your website unless you give them a way to do so. This MCP server is that bridge.

You might use this to:

- Help users find answers in your documentation
- Give AI assistants access to your blog's content
- Enable search across an internal knowledge base

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Your Static Site                              │
│                    (Markdown files with frontmatter)                    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             Adapter                                     │
│         (Astro, Hugo, or Generic — runs at build time)                  │
│                                                                         │
│   Scans your content files, extracts metadata from frontmatter,         │
│   and generates a search-index.json file.                               │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Cloudflare R2                                   │
│                                                                         │
│   Stores the search index. Only your Worker can access it.              │
│   The Worker caches the index in memory for one hour.                   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Cloudflare Worker                                 │
│                                                                         │
│   Implements the MCP server. Uses Fuse.js for fuzzy search.             │
│   Durable Objects maintain persistent sessions with MCP clients.        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          MCP Clients                                    │
│           (Claude Desktop, Claude Code, Cursor, etc.)                   │
│                                                                         │
│   Tools available to the AI:                                            │
│   • search_<prefix> — Find content by keywords                          │
│   • get_article     — Retrieve a specific page by URL                   │
│   • get_index_info  — Get index statistics                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

| Requirement | What It's For |
|-------------|---------------|
| [Cloudflare account](https://dash.cloudflare.com/sign-up) | Hosts the Worker and R2 bucket. The free tier is sufficient. |
| [Node.js 18+](https://nodejs.org/) or [Bun](https://bun.sh/) | Runs the adapter that generates your search index. |
| [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) | Deploys the Worker and manages R2. Installed via `bun install`. |

## Quick Start

You can follow these steps manually or point an AI coding tool (Claude Code, Cursor, etc.) at this repo and ask it to set things up. Either way, you'll need a Cloudflare account and these details about your site:

- **Site name and domain** (e.g., "My Blog" and "blog.example.com")
- **Content directory** path to your markdown files
- **Tool prefix** for MCP tool names (e.g., "myblog" → `search_myblog`)
- **MCP endpoint domain** (e.g., "mcp.example.com")

### 1. Clone and Install

```bash
git clone https://github.com/lennyzeltser/cloudflare-mcp-for-static-sites.git my-site-mcp
cd my-site-mcp
bun install
```

### 2. Configure

Edit `wrangler.jsonc`:

```jsonc
{
  "name": "my-site-mcp-server",
  "routes": [
    { "pattern": "mcp.example.com", "custom_domain": true }
  ],
  "r2_buckets": [
    { "binding": "SEARCH_BUCKET", "bucket_name": "my-site-mcp-data" }
  ]
}
```

### 3. Create R2 Bucket

```bash
npx wrangler r2 bucket create my-site-mcp-data
```

### 4. Generate and Upload Index

Pick an adapter for your site (see [Adapters](#adapters)):

```bash
node adapters/generic/generate-index.js \
  --content-dir=../my-site/content \
  --site-name="My Site" \
  --site-domain="example.com" \
  --tool-prefix="mysite"

npx wrangler r2 object put my-site-mcp-data/search-index.json \
  --file=./search-index.json \
  --content-type=application/json
```

### 5. Deploy

```bash
bun run deploy
```

Your MCP server is now running. Connect an MCP client to start searching.

---

## MCP Client Setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### Claude Code

```bash
claude mcp add my-site --transport sse https://mcp.example.com/sse
```

### Cursor

Add to your Cursor `mcp.json`:

```json
{
  "mcpServers": {
    "my-site": {
      "url": "https://mcp.example.com/sse"
    }
  }
}
```

### Other Clients

Use the [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) package to connect via the `/sse` endpoint (SSE transport) or `/mcp` endpoint (streamable HTTP).

### Available Tools

| Tool | Description |
|------|-------------|
| `search_<prefix>` | Search by keywords. Returns titles, URLs, dates, and summaries. |
| `get_article` | Retrieve full content by URL path (e.g., `/about`). |
| `get_index_info` | Get page count, generation date, and tool names. |

---

## Adapters

An adapter generates the search index from your content. It scans your files, extracts frontmatter metadata, and outputs `search-index.json`.

Each adapter handles the specifics of a particular static site generator.

### Generic (Markdown)

Works with any site that uses markdown files with YAML frontmatter.

```bash
node adapters/generic/generate-index.js \
  --content-dir=./content \
  --site-name="My Website" \
  --site-domain="example.com" \
  --tool-prefix="mysite" \
  --output=./search-index.json
```

See [`adapters/generic/README.md`](adapters/generic/README.md).

### Astro

An Astro integration that generates the index at build time.

```javascript
// astro.config.mjs
import { searchIndexIntegration } from './src/integrations/search-index.mjs';

export default defineConfig({
  integrations: [
    searchIndexIntegration({
      siteName: 'My Blog',
      siteDomain: 'blog.example.com',
      toolPrefix: 'myblog',
    }),
  ],
});
```

See [`adapters/astro/README.md`](adapters/astro/README.md).

### Hugo

A Node.js script that handles both TOML and YAML frontmatter.

```bash
node adapters/hugo/generate-index.js \
  --content-dir=./content \
  --site-name="My Hugo Site" \
  --site-domain="example.com"
```

See [`adapters/hugo/README.md`](adapters/hugo/README.md).

### Writing Your Own Adapter

If your static site generator isn't listed, you can write an adapter. It just needs to output JSON in the v3.0 format.

Your adapter should:

1. Find your content files (markdown, MDX, HTML, etc.)
2. Extract metadata from frontmatter (title, date, tags)
3. Extract body text for search
4. Map file paths to URLs
5. Write `search-index.json`

Here's a template:

```javascript
import { writeFileSync } from 'fs';

const pages = [/* your content processing logic */];

const index = {
  version: "3.0",
  generated: new Date().toISOString(),
  site: {
    name: "My Site",
    domain: "example.com",
    description: "Brief description for the MCP tool",
    toolPrefix: "mysite",
  },
  pageCount: pages.length,
  pages: pages.map(page => ({
    url: page.url,           // Required: starts with /
    title: page.title,       // Required
    abstract: page.summary,  // Optional
    date: page.date,         // Optional: YYYY-MM-DD
    topics: page.tags,       // Optional: array
    body: page.content,      // Recommended for search quality
  })),
};

writeFileSync("search-index.json", JSON.stringify(index, null, 2));
```

Validate your index:

```bash
bun scripts/validate-index.ts ./search-index.json
```

Upload to R2:

```bash
npx wrangler r2 object put my-site-mcp-data/search-index.json \
  --file=./search-index.json \
  --content-type=application/json
```

---

## Configuration

### wrangler.jsonc

| Field | Description |
|-------|-------------|
| `name` | Worker name in Cloudflare dashboard |
| `routes[].pattern` | Your custom domain |
| `r2_buckets[].bucket_name` | R2 bucket name |

For testing, you can use a workers.dev subdomain instead of a custom domain:

```jsonc
"workers_dev": true,
// Comment out "routes"
```

### Index Format

The search index follows the v3.0 schema:

```json
{
  "version": "3.0",
  "generated": "2025-01-15T12:00:00.000Z",
  "site": {
    "name": "My Website",
    "domain": "example.com",
    "description": "A site about interesting topics",
    "toolPrefix": "mysite"
  },
  "pageCount": 42,
  "pages": [
    {
      "url": "/about",
      "title": "About Us",
      "abstract": "Learn about our team.",
      "date": "2025-01-01",
      "topics": ["about", "team"],
      "body": "Full page content..."
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `version` | Yes | Schema version ("3.0") |
| `generated` | Yes | ISO 8601 timestamp |
| `site.name` | Yes | Site name |
| `site.domain` | Yes | Domain without protocol |
| `site.description` | No | Shown in MCP tool description |
| `site.toolPrefix` | No | Tool name prefix (default: `website`) |
| `pageCount` | Yes | Number of pages |
| `pages[].url` | Yes | Path starting with `/` |
| `pages[].title` | Yes | Page title |
| `pages[].body` | No | Full text (recommended) |

---

## Development

```bash
bun run dev          # Local development server
bun run type-check   # TypeScript checking
bun run lint:fix     # Lint and fix
bun run format       # Format code
bun run deploy       # Deploy to Cloudflare
```

---

## Troubleshooting

### "Search index not found in R2 bucket"

1. Check the bucket exists: `npx wrangler r2 bucket list`
2. Check the file was uploaded: `npx wrangler r2 object list my-site-mcp-data`
3. Verify the bucket name in `wrangler.jsonc` matches

### MCP client won't connect

1. Use the correct endpoint: `/sse` for SSE, `/mcp` for HTTP
2. Visit your worker URL in a browser — you should see JSON
3. Make sure the URL includes `https://`

### Search returns no results

1. Validate your index: `bun scripts/validate-index.ts ./search-index.json`
2. Check that pages have `body` content
3. Try broader search terms

### Wrong tool names

Tool names come from `toolPrefix` in your search index. Regenerate and re-upload the index with the correct value.

### Local development

You need a local copy of the search index:

```bash
mkdir -p .wrangler/state/r2/my-site-mcp-data
cp search-index.json .wrangler/state/r2/my-site-mcp-data/search-index.json
```

---

## Examples

Two sites using this approach:

### REMnux Documentation

MCP server for [REMnux](https://remnux.org), the Linux toolkit for malware analysis.

**Repo:** [github.com/REMnux/remnux-docs-mcp-server](https://github.com/REMnux/remnux-docs-mcp-server)

```bash
# Claude Code
claude mcp add remnux-docs --transport sse https://docs-mcp.remnux.org/sse
```

### Lenny Zeltser's Website

MCP server for [zeltser.com](https://zeltser.com), covering malware analysis, incident response, and security leadership.

```bash
# Claude Code
claude mcp add zeltser-search --transport sse https://website-mcp.zeltser.com/sse
```

---

## Author

**Lenny Zeltser** is a cybersecurity leader who builds security programs, tools, and educational content. He serves as CISO at Axonius, created the REMnux malware analysis toolkit, and authored SANS courses on reverse-engineering malware and cybersecurity writing. He holds an MBA from MIT Sloan and a Computer Science degree from the University of Pennsylvania. More at [zeltser.com](https://zeltser.com).
