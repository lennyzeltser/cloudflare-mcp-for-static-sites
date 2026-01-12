# Generic Markdown Adapter

This adapter generates a search index from markdown files with YAML frontmatter. It works with any static site that follows this structure.

See the [main README](../../README.md) for deployment instructions.

## Usage

```bash
node generate-index.js \
  --content-dir=./content \
  --site-name="My Blog" \
  --site-domain="blog.example.com" \
  --tool-prefix="myblog" \
  --output=search-index.json
```

You can also use environment variables:

```bash
SITE_NAME="My Blog" \
SITE_DOMAIN="blog.example.com" \
TOOL_PREFIX="myblog" \
node generate-index.js
```

## Options

| Option | Environment Variable | Default | Description |
|--------|---------------------|---------|-------------|
| `--content-dir` | `CONTENT_DIR` | `./content` | Directory with markdown files |
| `--output` | `OUTPUT` | `./search-index.json` | Output file |
| `--site-name` | `SITE_NAME` | `My Website` | Site name |
| `--site-domain` | `SITE_DOMAIN` | `example.com` | Site domain |
| `--site-description` | `SITE_DESCRIPTION` | (empty) | Site description |
| `--tool-prefix` | `TOOL_PREFIX` | `website` | Tool name prefix |

## Frontmatter

The script reads these frontmatter fields:

```yaml
---
title: "Article Title"           # Required
description: "Summary text"      # Optional (also: summary, abstract)
date: "2025-01-15"              # Optional
tags: ["tag1", "tag2"]          # Optional (also: topics, categories)
draft: true                      # Optional — skips if true
---
```

## Customization

This script is meant to be modified for your site. Common changes:

- **URL generation**: Edit `pathToUrl()` to match how your site structures URLs
- **Frontmatter parsing**: Extend `parseFrontmatter()` for custom fields
- **Filtering**: Add logic to `processFile()` to skip certain files

## Upload to R2

After generating the index:

```bash
npx wrangler r2 object put my-site-mcp-data/search-index.json \
  --file=./search-index.json \
  --content-type=application/json
```
