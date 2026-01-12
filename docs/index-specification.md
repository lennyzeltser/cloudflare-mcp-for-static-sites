# Search Index Specification v3.0

This document describes the search index format used by the MCP server.

## Overview

The search index is a JSON file containing all searchable content from your static site. It's stored in R2 and loaded by the MCP server to enable full-text search.

## Schema

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
      "abstract": "Learn about our team and mission.",
      "date": "2025-01-01",
      "topics": ["about", "team"],
      "body": "Full page content here..."
    }
  ]
}
```

## Root Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Schema version (e.g., `"3.0"`) |
| `generated` | string | Yes | ISO 8601 timestamp when index was created |
| `site` | object | Yes | Site metadata (see below) |
| `pageCount` | number | Yes | Total number of pages in the index |
| `pages` | array | Yes | Array of page objects |

## Site Metadata

The `site` object configures MCP server branding and tool naming.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable site name (e.g., "My Blog") |
| `domain` | string | Yes | Domain without protocol (e.g., "blog.example.com") |
| `description` | string | No | Brief description shown in tool descriptions |
| `toolPrefix` | string | No | Prefix for tool names (default: `website`) |

### Tool Prefix

The `toolPrefix` determines the search tool name:

- `toolPrefix: "myblog"` → tool is named `search_myblog`
- `toolPrefix: "docs"` → tool is named `search_docs`
- No prefix → tool is named `search_website`

**Requirements:**
- Must start with a lowercase letter
- Only lowercase letters, numbers, and underscores
- Regex: `^[a-z][a-z0-9_]*$`

## Page Objects

Each page in the `pages` array represents one searchable document.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | URL path starting with `/` |
| `title` | string | Yes | Page title |
| `abstract` | string | No | Brief summary (shown in search results) |
| `date` | string | No | Publication date (YYYY-MM-DD format) |
| `topics` | array | No | Tags/categories (array of strings) |
| `body` | string | No | Full text content for search |

### URL Format

URLs should be:
- Relative paths starting with `/`
- Without the domain (e.g., `/about` not `https://example.com/about`)
- Without trailing slashes (e.g., `/posts/hello` not `/posts/hello/`)

### Body Content

The `body` field contains the full text content for searching. While optional, including it significantly improves search quality.

**Best practices:**
- Strip HTML tags
- Include all meaningful text content
- Preserve paragraph breaks (useful for context)
- Exclude navigation, footers, and repeated elements

## Search Behavior

The MCP server uses [Fuse.js](https://www.fusejs.io/) for fuzzy search with these field weights:

| Field | Weight | Description |
|-------|--------|-------------|
| `body` | 0.35 | Full content (highest priority) |
| `title` | 0.30 | Page title |
| `abstract` | 0.20 | Summary text |
| `topics` | 0.15 | Tags and categories |

## Validation

Use the included validation script to check your index:

```bash
bun scripts/validate-index.ts ./search-index.json
```

This checks:
- Required fields are present
- URL format is correct
- `pageCount` matches actual page count
- No duplicate URLs
- `toolPrefix` format is valid

## Migration from v2.x

Version 3.0 added the `site` metadata object. Indexes without `site` are still supported—the server uses defaults:

```javascript
// Default site metadata for v2.x indexes
site: {
  name: "Website",
  domain: "example.com",
  description: "Search this website"
}
```

To upgrade, add the `site` object to your index generator.
