# Hugo Adapter

This adapter generates a search index from Hugo content. It handles both TOML (`+++`) and YAML (`---`) frontmatter.

See the [main README](../../README.md) for deployment instructions.

## Usage

```bash
node generate-index.js \
  --content-dir=../my-hugo-site/content \
  --site-name="My Blog" \
  --site-domain="blog.example.com" \
  --tool-prefix="myblog" \
  --output=public/search-index.json
```

## Options

| Option | Environment Variable | Default | Description |
|--------|---------------------|---------|-------------|
| `--content-dir` | `CONTENT_DIR` | `./content` | Hugo content directory |
| `--output` | `OUTPUT` | `./public/search-index.json` | Output file |
| `--site-name` | `SITE_NAME` | `My Website` | Site name |
| `--site-domain` | `SITE_DOMAIN` | `example.com` | Site domain |
| `--site-description` | `SITE_DESCRIPTION` | (empty) | Site description |
| `--tool-prefix` | `TOOL_PREFIX` | `website` | Tool name prefix |

## Build Integration

Run the script after Hugo builds your site:

```bash
hugo && node path/to/generate-index.js --content-dir=content
```

Or in `netlify.toml`:

```toml
[build]
  command = "hugo && node scripts/generate-index.js"
```

## Frontmatter

### TOML

```toml
+++
title = "My Post"
date = "2025-01-15"
description = "A summary"
tags = ["tag1", "tag2"]
draft = false
+++
```

### YAML

```yaml
---
title: "My Post"
date: "2025-01-15"
description: "A summary"
tags: ["tag1", "tag2"]
draft: false
---
```

## URL Generation

File paths map to URLs like this:

| File Path | URL |
|-----------|-----|
| `content/posts/my-post.md` | `/posts/my-post` |
| `content/about/_index.md` | `/about` |
| `content/_index.md` | `/` |

Edit `hugoPathToUrl()` if your site uses different URL patterns.

## Upload to R2

After generating the index:

```bash
npx wrangler r2 object put my-site-mcp-data/search-index.json \
  --file=./public/search-index.json \
  --content-type=application/json
```
