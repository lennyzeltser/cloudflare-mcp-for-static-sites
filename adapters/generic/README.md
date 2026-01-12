# Generic Markdown Adapter

A customizable Node.js script that generates a search index from markdown files with YAML frontmatter.

## Usage

```bash
node generate-index.js \
  --content-dir=./content \
  --site-name="My Blog" \
  --site-domain="blog.example.com" \
  --tool-prefix="myblog" \
  --output=search-index.json
```

Or with environment variables:

```bash
SITE_NAME="My Blog" \
SITE_DOMAIN="blog.example.com" \
TOOL_PREFIX="myblog" \
node generate-index.js
```

## Options

| Option | Env Variable | Default | Description |
|--------|--------------|---------|-------------|
| `--content-dir` | `CONTENT_DIR` | `./content` | Directory containing markdown files |
| `--output` | `OUTPUT` | `./search-index.json` | Output file path |
| `--site-name` | `SITE_NAME` | `My Website` | Site name for MCP branding |
| `--site-domain` | `SITE_DOMAIN` | `example.com` | Site domain |
| `--site-description` | `SITE_DESCRIPTION` | (empty) | Site description |
| `--tool-prefix` | `TOOL_PREFIX` | `website` | Tool name prefix |

## Frontmatter Fields

The script recognizes these frontmatter fields:

```yaml
---
title: "Article Title"           # Required
description: "Summary text"      # Optional (also: summary, abstract)
date: "2025-01-15"              # Optional
tags: ["tag1", "tag2"]          # Optional (also: topics, categories)
draft: true                      # Optional - skips if true
---
```

## Customization

This script is meant to be customized for your content structure. Common modifications:

1. **URL generation** - Edit `pathToUrl()` to match your site's URL structure
2. **Frontmatter parsing** - Extend `parseFrontmatter()` for custom fields
3. **Content filtering** - Add logic to `processFile()` to skip certain files

## Example

```bash
# Generate index from Hugo content
node generate-index.js \
  --content-dir=../my-hugo-site/content/posts \
  --site-name="My Tech Blog" \
  --site-domain="techblog.example.com" \
  --tool-prefix="techblog"
```
