#!/usr/bin/env node
/**
 * Generic Search Index Generator
 *
 * Generates a v3.0 MCP search index from markdown files with YAML frontmatter.
 * Customize this script for your content structure.
 *
 * Usage:
 *   node generate-index.js --content-dir=./content --output=search-index.json
 *
 * Or with environment variables:
 *   SITE_NAME="My Blog" SITE_DOMAIN="blog.example.com" node generate-index.js
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, basename, extname } from 'path';

// Configuration from CLI args or environment variables
const config = {
    contentDir: process.env.CONTENT_DIR || './content',
    output: process.env.OUTPUT || './search-index.json',
    siteName: process.env.SITE_NAME || 'My Website',
    siteDomain: process.env.SITE_DOMAIN || 'example.com',
    siteDescription: process.env.SITE_DESCRIPTION || '',
    toolPrefix: process.env.TOOL_PREFIX || 'website',
};

// Parse CLI arguments
for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--content-dir=')) {
        config.contentDir = arg.split('=')[1];
    } else if (arg.startsWith('--output=')) {
        config.output = arg.split('=')[1];
    } else if (arg.startsWith('--site-name=')) {
        config.siteName = arg.split('=')[1];
    } else if (arg.startsWith('--site-domain=')) {
        config.siteDomain = arg.split('=')[1];
    } else if (arg.startsWith('--site-description=')) {
        config.siteDescription = arg.split('=')[1];
    } else if (arg.startsWith('--tool-prefix=')) {
        config.toolPrefix = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
        console.log(`
Generic Search Index Generator

Usage:
  node generate-index.js [options]

Options:
  --content-dir=PATH      Directory containing markdown files (default: ./content)
  --output=PATH           Output file path (default: ./search-index.json)
  --site-name=NAME        Site name for MCP branding
  --site-domain=DOMAIN    Site domain (e.g., blog.example.com)
  --site-description=DESC Site description
  --tool-prefix=PREFIX    Tool name prefix (e.g., "mysite" → search_mysite)

Environment Variables:
  CONTENT_DIR, OUTPUT, SITE_NAME, SITE_DOMAIN, SITE_DESCRIPTION, TOOL_PREFIX
`);
        process.exit(0);
    }
}

/**
 * Parse YAML frontmatter from markdown content
 * Returns { frontmatter, body }
 */
function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        return { frontmatter: {}, body: content };
    }

    const frontmatter = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();

            // Handle arrays
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
            }
            // Handle quoted strings
            else if ((value.startsWith('"') && value.endsWith('"')) ||
                     (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            frontmatter[key] = value;
        }
    }

    return { frontmatter, body: match[2] };
}

/**
 * Convert file path to URL
 * Customize this for your URL structure
 */
function pathToUrl(filePath, contentDir) {
    let url = '/' + relative(contentDir, filePath)
        .replace(/\\/g, '/')           // Windows paths
        .replace(/\.md$/, '')          // Remove .md extension
        .replace(/\/index$/, '');      // Remove /index

    // Handle root index
    if (url === '/') url = '/';

    return url;
}

/**
 * Recursively find all markdown files
 */
function findMarkdownFiles(dir, files = []) {
    if (!existsSync(dir)) {
        console.error(`Error: Directory not found: ${dir}`);
        process.exit(1);
    }

    for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            findMarkdownFiles(fullPath, files);
        } else if (extname(entry) === '.md') {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Process a markdown file into a search page
 */
function processFile(filePath, contentDir) {
    const content = readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    // Skip drafts
    if (frontmatter.draft === true || frontmatter.draft === 'true') {
        return null;
    }

    const url = pathToUrl(filePath, contentDir);

    return {
        url,
        title: frontmatter.title || basename(filePath, '.md'),
        abstract: frontmatter.description || frontmatter.summary || frontmatter.abstract || '',
        date: frontmatter.date || '',
        topics: Array.isArray(frontmatter.tags) ? frontmatter.tags :
                Array.isArray(frontmatter.topics) ? frontmatter.topics :
                Array.isArray(frontmatter.categories) ? frontmatter.categories : [],
        body: body.trim(),
    };
}

// Main
console.log(`Scanning ${config.contentDir} for markdown files...`);

const files = findMarkdownFiles(config.contentDir);
console.log(`Found ${files.length} markdown files`);

const pages = [];
let skipped = 0;

for (const file of files) {
    const page = processFile(file, config.contentDir);
    if (page) {
        pages.push(page);
    } else {
        skipped++;
    }
}

const index = {
    version: '3.0',
    generated: new Date().toISOString(),
    site: {
        name: config.siteName,
        domain: config.siteDomain,
        description: config.siteDescription,
        toolPrefix: config.toolPrefix,
    },
    pageCount: pages.length,
    pages,
};

writeFileSync(config.output, JSON.stringify(index, null, 2));
console.log(`Generated index with ${pages.length} pages (${skipped} skipped)`);
console.log(`Output: ${config.output}`);
