# Creating Custom Adapters

Build an adapter to generate search indexes from any static site generator.

## Overview

An adapter reads your site's content files, extracts metadata and text, and outputs a `search-index.json` file in the [v3.0 format](./index-specification.md).

## Basic Structure

```javascript
#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, basename, extname } from 'path';

// 1. Configuration
const config = {
  contentDir: process.env.CONTENT_DIR || './content',
  output: process.env.OUTPUT || './search-index.json',
  siteName: process.env.SITE_NAME || 'My Website',
  siteDomain: process.env.SITE_DOMAIN || 'example.com',
  toolPrefix: process.env.TOOL_PREFIX || 'website',
};

// 2. Find content files
function findContentFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      findContentFiles(fullPath, files);
    } else if (extname(entry) === '.md') {
      files.push(fullPath);
    }
  }
  return files;
}

// 3. Parse frontmatter and extract content
function parseFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  // ... parse frontmatter
  // ... extract body text
  return { frontmatter, body };
}

// 4. Convert file path to URL
function pathToUrl(filePath, contentDir) {
  return '/' + relative(contentDir, filePath)
    .replace(/\\/g, '/')
    .replace(/\.md$/, '')
    .replace(/\/index$/, '');
}

// 5. Process all files
const files = findContentFiles(config.contentDir);
const pages = files.map(file => {
  const { frontmatter, body } = parseFile(file);
  return {
    url: pathToUrl(file, config.contentDir),
    title: frontmatter.title || basename(file, '.md'),
    abstract: frontmatter.description || '',
    date: frontmatter.date || '',
    topics: frontmatter.tags || [],
    body: body.trim(),
  };
}).filter(page => page !== null);

// 6. Generate index
const index = {
  version: '3.0',
  generated: new Date().toISOString(),
  site: {
    name: config.siteName,
    domain: config.siteDomain,
    toolPrefix: config.toolPrefix,
  },
  pageCount: pages.length,
  pages,
};

// 7. Write output
writeFileSync(config.output, JSON.stringify(index, null, 2));
console.log(`Generated index with ${pages.length} pages`);
```

## Frontmatter Parsing

Most static sites use YAML or TOML frontmatter. Here's how to parse common formats:

### YAML Frontmatter

```javascript
function parseYAMLFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      // Handle quoted strings
      if (value.startsWith('"') || value.startsWith("'")) {
        value = value.slice(1, -1);
      }
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body: match[2] };
}
```

### TOML Frontmatter (Hugo)

```javascript
function parseTOMLFrontmatter(content) {
  const match = content.match(/^\+\+\+\n([\s\S]*?)\n\+\+\+\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (m) {
      let value = m[2].trim();
      if (value.startsWith('"')) value = value.slice(1, -1);
      frontmatter[m[1]] = value;
    }
  }

  return { frontmatter, body: match[2] };
}
```

### Using gray-matter

For robust frontmatter parsing, use the `gray-matter` library:

```javascript
import matter from 'gray-matter';

const { data: frontmatter, content: body } = matter(fileContent);
```

## URL Generation

Map file paths to site URLs. Common patterns:

| File Path | URL |
|-----------|-----|
| `content/about.md` | `/about` |
| `content/posts/hello.md` | `/posts/hello` |
| `content/posts/index.md` | `/posts` |
| `content/docs/_index.md` | `/docs` |

```javascript
function pathToUrl(filePath, contentDir) {
  let url = '/' + relative(contentDir, filePath)
    .replace(/\\/g, '/')        // Windows paths
    .replace(/\.md$/, '')       // Remove extension
    .replace(/\/index$/, '')    // index.md -> parent
    .replace(/\/_index$/, '');  // Hugo sections

  return url === '/.' ? '/' : url;
}
```

## Handling Special Content

### Draft Posts

Skip unpublished content:

```javascript
if (frontmatter.draft === true) {
  return null;
}
```

### Excluding Pages

Filter by path or frontmatter:

```javascript
const excludePaths = ['/admin', '/drafts'];
if (excludePaths.some(p => url.startsWith(p))) {
  return null;
}
```

### HTML Content

If your content is HTML, strip tags for the body:

```javascript
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

## Command-Line Arguments

Support both environment variables and CLI flags:

```javascript
// Parse CLI arguments
for (const arg of process.argv.slice(2)) {
  const [key, value] = arg.split('=');
  switch (key) {
    case '--content-dir': config.contentDir = value; break;
    case '--output': config.output = value; break;
    case '--site-name': config.siteName = value; break;
    case '--site-domain': config.siteDomain = value; break;
    case '--tool-prefix': config.toolPrefix = value; break;
  }
}
```

## Build Integration

### As npm Script

```json
{
  "scripts": {
    "index": "node scripts/generate-index.js",
    "build": "your-build-command && npm run index"
  }
}
```

### CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Generate search index
  run: |
    node scripts/generate-index.js \
      --site-name="${{ vars.SITE_NAME }}" \
      --site-domain="${{ vars.SITE_DOMAIN }}"

- name: Upload to R2
  run: |
    npx wrangler r2 object put ${{ vars.R2_BUCKET }}/search-index.json \
      --file=./search-index.json \
      --content-type=application/json
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Validation

Always validate your generated index:

```bash
bun scripts/validate-index.ts ./search-index.json
```

This catches common issues:
- Missing required fields
- Invalid URL format
- Duplicate URLs
- Mismatched `pageCount`

## Examples

See the included adapters for reference implementations:

- [`adapters/generic/`](../adapters/generic/) — Basic markdown with YAML frontmatter
- [`adapters/hugo/`](../adapters/hugo/) — Hugo with TOML/YAML support
- [`adapters/astro/`](../adapters/astro/) — Astro build integration
