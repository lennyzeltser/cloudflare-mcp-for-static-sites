# Cloudflare MCP Server for Static Sites

Turn any static website into an MCP-searchable knowledge base. Deploy a Cloudflare Worker that provides [Model Context Protocol](https://modelcontextprotocol.io) search tools for AI assistants like Claude, enabling them to search and retrieve content from your site.

## Features

- **Full-text search** with fuzzy matching via [Fuse.js](https://www.fusejs.io/)
- **Dynamic tool naming** — tools automatically include your site's prefix (e.g., `search_myblog`)
- **Multiple adapters** — Astro, Hugo, or generic markdown
- **Fast R2 storage** — search index lives in Cloudflare R2
- **Zero cold starts** — uses Durable Objects for persistent MCP sessions
- **Simple deployment** — single `wrangler deploy` command

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/lennyzeltser/cloudflare-mcp-for-static-sites.git my-site-mcp
cd my-site-mcp
bun install
```

### 2. Configure

Edit `wrangler.jsonc` with your settings:

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

Choose an adapter for your site (see [Adapters](#adapters) below):

```bash
# Generic markdown
node adapters/generic/generate-index.js \
  --content-dir=../my-site/content \
  --site-name="My Site" \
  --site-domain="example.com" \
  --tool-prefix="mysite"

# Upload to R2
npx wrangler r2 object put my-site-mcp-data/search-index.json \
  --file=./search-index.json \
  --content-type=application/json
```

### 5. Deploy

```bash
bun run deploy
```

Your MCP server is now live. Connect an MCP client to start searching.

---

## Adapters

Adapters generate the search index from your content. Each outputs a `search-index.json` file in the [v3.0 index format](#index-format).

### Generic (Markdown)

For any site with markdown files and YAML frontmatter.

```bash
node adapters/generic/generate-index.js \
  --content-dir=./content \
  --site-name="My Website" \
  --site-domain="example.com" \
  --tool-prefix="mysite" \
  --output=./search-index.json
```

See [`adapters/generic/README.md`](adapters/generic/README.md) for full options.

### Astro

Build-time integration for Astro projects.

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

See [`adapters/astro/README.md`](adapters/astro/README.md) for setup instructions.

### Hugo

Node.js script for Hugo sites with TOML or YAML frontmatter.

```bash
node adapters/hugo/generate-index.js \
  --content-dir=./content \
  --site-name="My Hugo Site" \
  --site-domain="example.com"
```

See [`adapters/hugo/README.md`](adapters/hugo/README.md) for details.

---

## Configuration

### wrangler.jsonc

Key settings to customize:

| Field | Description |
|-------|-------------|
| `name` | Worker name (appears in Cloudflare dashboard) |
| `routes[].pattern` | Your custom domain for the MCP endpoint |
| `r2_buckets[].bucket_name` | R2 bucket storing your search index |

**Custom domain vs workers.dev:**

```jsonc
// Option A: Custom domain (recommended)
"routes": [{ "pattern": "mcp.example.com", "custom_domain": true }],
"workers_dev": false,

// Option B: workers.dev subdomain (for testing)
"workers_dev": true,
// Comment out routes
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
      "body": "Full page content here..."
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `site.name` | Yes | Human-readable site name |
| `site.domain` | Yes | Domain without protocol |
| `site.toolPrefix` | No | Tool name prefix (default: `website`) |
| `pages[].url` | Yes | Path starting with `/` |
| `pages[].title` | Yes | Page title |
| `pages[].body` | No | Full content for search (recommended) |

Validate your index:

```bash
bun scripts/validate-index.ts ./search-index.json
```

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

Add to Cursor settings (`mcp.json`):

```json
{
  "mcpServers": {
    "my-site": {
      "url": "https://mcp.example.com/sse"
    }
  }
}
```

### Verify Connection

Once connected, your MCP client will have access to these tools:

| Tool | Description |
|------|-------------|
| `search_<prefix>` | Search content by keywords |
| `get_article` | Get full article by URL path |
| `get_index_info` | Index statistics |

Example queries:
- "Search my-site for authentication tutorials"
- "Get the article at /getting-started"

---

## Creating Custom Adapters

Build an adapter for your static site generator by outputting the v3.0 index format.

### Minimum Requirements

1. **Scan content files** — find markdown, HTML, or other content
2. **Extract metadata** — title, date, topics from frontmatter
3. **Extract body text** — full content for search
4. **Generate URL paths** — map file paths to site URLs
5. **Output JSON** — write `search-index.json`

### Template

```javascript
const index = {
  version: "3.0",
  generated: new Date().toISOString(),
  site: {
    name: "My Site",
    domain: "example.com",
    description: "Site description",
    toolPrefix: "mysite",
  },
  pageCount: pages.length,
  pages: pages.map(page => ({
    url: page.url,
    title: page.title,
    abstract: page.summary || "",
    date: page.date || "",
    topics: page.tags || [],
    body: page.content,
  })),
};

writeFileSync("search-index.json", JSON.stringify(index, null, 2));
```

### Upload to R2

After generating, upload to your R2 bucket:

```bash
npx wrangler r2 object put my-site-mcp-data/search-index.json \
  --file=./search-index.json \
  --content-type=application/json
```

---

## Development

```bash
# Local development server
bun run dev

# Type checking
bun run type-check

# Lint and format
bun run lint:fix
bun run format

# Deploy to Cloudflare
bun run deploy
```

---

## License

MIT
