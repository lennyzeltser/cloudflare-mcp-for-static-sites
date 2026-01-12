# Setup Guide

Complete walkthrough for deploying your own MCP search server.

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [Node.js](https://nodejs.org/) 18+ or [Bun](https://bun.sh/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (included as dev dependency)

## Step 1: Clone the Template

```bash
git clone https://github.com/lennyzeltser/cloudflare-mcp-for-static-sites.git my-site-mcp
cd my-site-mcp
bun install  # or: npm install
```

## Step 2: Authenticate with Cloudflare

```bash
npx wrangler login
```

This opens a browser for OAuth authentication.

## Step 3: Create R2 Bucket

```bash
npx wrangler r2 bucket create my-site-mcp-data
```

Choose a descriptive name—you'll reference this in the config.

## Step 4: Configure wrangler.jsonc

Edit `wrangler.jsonc`:

```jsonc
{
  // Worker name (appears in Cloudflare dashboard)
  "name": "my-site-mcp-server",

  // Your custom domain
  "routes": [
    { "pattern": "mcp.example.com", "custom_domain": true }
  ],
  "workers_dev": false,

  // R2 bucket from Step 3
  "r2_buckets": [
    { "binding": "SEARCH_BUCKET", "bucket_name": "my-site-mcp-data" }
  ]
}
```

**Using workers.dev instead of custom domain:**

```jsonc
{
  "workers_dev": true,
  // Remove or comment out "routes"
}
```

Your MCP endpoint will be: `https://my-site-mcp-server.<account>.workers.dev`

## Step 5: Generate Search Index

Choose the adapter for your static site generator:

### Generic Markdown

```bash
node adapters/generic/generate-index.js \
  --content-dir=/path/to/your/content \
  --site-name="My Website" \
  --site-domain="example.com" \
  --tool-prefix="mysite" \
  --output=./search-index.json
```

### Astro

Copy `adapters/astro/search-index.mjs` to your Astro project and add to `astro.config.mjs`. See [Astro adapter docs](../adapters/astro/README.md).

### Hugo

```bash
node adapters/hugo/generate-index.js \
  --content-dir=/path/to/hugo/content \
  --site-name="My Hugo Site" \
  --site-domain="example.com"
```

## Step 6: Upload Index to R2

```bash
npx wrangler r2 object put my-site-mcp-data/search-index.json \
  --file=./search-index.json \
  --content-type=application/json
```

## Step 7: Deploy Worker

```bash
bun run deploy  # or: npm run deploy
```

First deploy may prompt you to:
1. Confirm the custom domain
2. Add DNS records (if using custom domain)

## Step 8: Verify Deployment

Visit your MCP endpoint root URL:

```bash
curl https://mcp.example.com/
```

Should return:

```json
{
  "name": "My Website MCP Search Server",
  "version": "3.0.0",
  "site": {
    "name": "My Website",
    "domain": "example.com"
  },
  "endpoints": {
    "sse": "/sse",
    "mcp": "/mcp"
  },
  "tools": ["search_mysite", "get_article", "get_index_info"]
}
```

## Step 9: Connect MCP Client

See [MCP Client Configurations](./mcp-client-configs.md) for setup instructions for:
- Claude Desktop
- Claude Code
- Cursor

## Updating Content

When your site content changes:

1. **Regenerate the index** using your adapter
2. **Upload to R2:**
   ```bash
   npx wrangler r2 object put my-site-mcp-data/search-index.json \
     --file=./search-index.json \
     --content-type=application/json
   ```

The MCP server caches the index for 1 hour. New content will be available after cache expires.

## Troubleshooting

### "Search index not found in R2 bucket"

The index file wasn't uploaded or has the wrong name.

```bash
# Check bucket contents
npx wrangler r2 object list my-site-mcp-data

# Re-upload
npx wrangler r2 object put my-site-mcp-data/search-index.json \
  --file=./search-index.json
```

### Custom domain not working

1. Verify DNS is configured in Cloudflare
2. Check the domain is proxied (orange cloud)
3. Wait for DNS propagation (up to 24 hours)

### MCP client can't connect

1. Verify the `/sse` endpoint responds: `curl https://mcp.example.com/sse`
2. Check the MCP client is using the full URL including `/sse`
3. Restart the MCP client after config changes

### Search returns no results

1. Validate your index: `bun scripts/validate-index.ts ./search-index.json`
2. Check that pages have `body` content
3. Verify the index was uploaded to the correct bucket
