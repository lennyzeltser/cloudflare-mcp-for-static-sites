# Astro Adapter

An Astro integration that generates a search index at build time from your content collections.

## Installation

Copy `search-index.mjs` to your Astro project's `src/integrations/` directory.

## Usage

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { searchIndexIntegration } from './src/integrations/search-index.mjs';

export default defineConfig({
  integrations: [
    searchIndexIntegration({
      siteName: 'My Blog',
      siteDomain: 'blog.example.com',
      siteDescription: 'A blog about things',
      toolPrefix: 'myblog',
      contentDir: 'src/content/posts',
    }),
  ],
});
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `siteName` | `My Website` | Site name for MCP branding |
| `siteDomain` | `example.com` | Site domain |
| `siteDescription` | (empty) | Site description |
| `toolPrefix` | `website` | Tool name prefix |
| `contentDir` | `src/content` | Content directory to scan |
| `outputFile` | `dist/mcp-search-index.json` | Output file path |
| `excludeSlugs` | `[]` | Array of slugs to exclude |
| `staticPages` | `[]` | Additional static pages to include |

## Static Pages

Include non-collection pages (like /about) using the `staticPages` option:

```javascript
searchIndexIntegration({
  // ... other options
  staticPages: [
    {
      url: '/about',
      title: 'About Us',
      abstract: 'Learn about our company',
      file: 'src/pages/about.md',  // Optional: read content from file
    },
  ],
});
```

## Output

After running `npm run build`, the index will be at `dist/mcp-search-index.json`.

Upload to R2:

```bash
npx wrangler r2 object put my-site-mcp-data/search-index.json \
  --file=dist/mcp-search-index.json \
  --content-type=application/json \
  --remote
```
