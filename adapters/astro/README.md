# Astro Adapter

This adapter generates a search index from your Astro content collections. It runs automatically at build time.

See the [main README](../../README.md) for deployment instructions.

## Installation

1. Install the `glob` dependency:

```bash
bun add glob
```

2. Copy `search-index.mjs` to `src/integrations/` in your Astro project.

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
| `siteName` | `My Website` | Site name |
| `siteDomain` | `example.com` | Site domain |
| `siteDescription` | (empty) | Site description |
| `toolPrefix` | `website` | Tool name prefix |
| `contentDir` | `src/content` | Content directory |
| `outputFile` | `dist/mcp-search-index.json` | Output path |
| `excludeSlugs` | `[]` | Slugs to exclude |
| `staticPages` | `[]` | Additional pages to include |

## Static Pages

To include pages that aren't in content collections (like `/about`):

```javascript
searchIndexIntegration({
  // ...
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

After `bun run build`, the index is at `dist/mcp-search-index.json`.

Upload to R2:

```bash
npx wrangler r2 object put my-site-mcp-data/search-index.json \
  --file=dist/mcp-search-index.json \
  --content-type=application/json
```
