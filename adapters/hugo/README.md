# Hugo Adapter

A Node.js script that generates a search index from Hugo markdown content. Supports both TOML (`+++`) and YAML (`---`) frontmatter.

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

| Option | Env Variable | Default | Description |
|--------|--------------|---------|-------------|
| `--content-dir` | `CONTENT_DIR` | `./content` | Hugo content directory |
| `--output` | `OUTPUT` | `./public/search-index.json` | Output file |
| `--site-name` | `SITE_NAME` | `My Website` | Site name |
| `--site-domain` | `SITE_DOMAIN` | `example.com` | Site domain |
| `--site-description` | `SITE_DESCRIPTION` | (empty) | Site description |
| `--tool-prefix` | `TOOL_PREFIX` | `website` | Tool name prefix |

## Hugo Integration

Add to your Hugo build process:

```bash
# In package.json scripts or Makefile
hugo && node path/to/generate-index.js --content-dir=content
```

Or as a post-build hook in `netlify.toml`:

```toml
[build]
  command = "hugo && node scripts/generate-index.js"
```

## Frontmatter Support

### TOML (Hugo default)

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

The script converts Hugo file paths to URLs:

| File Path | Generated URL |
|-----------|---------------|
| `content/posts/my-post.md` | `/posts/my-post` |
| `content/about/_index.md` | `/about` |
| `content/_index.md` | `/` |

Customize `hugoPathToUrl()` if your site uses a different URL structure.
