#!/usr/bin/env node
/**
 * Hugo Search Index Generator
 *
 * Generates a v3.0 MCP search index from Hugo markdown content.
 *
 * Usage:
 *   node generate-index.js --content-dir=./content --output=public/search-index.json
 *
 * Or with environment variables:
 *   SITE_NAME="My Blog" SITE_DOMAIN="blog.example.com" node generate-index.js
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, basename, extname, dirname } from 'path';

// Configuration
const config = {
    contentDir: process.env.CONTENT_DIR || './content',
    output: process.env.OUTPUT || './public/search-index.json',
    siteName: process.env.SITE_NAME || 'My Website',
    siteDomain: process.env.SITE_DOMAIN || 'example.com',
    siteDescription: process.env.SITE_DESCRIPTION || '',
    toolPrefix: process.env.TOOL_PREFIX || 'website',
};

// Parse CLI arguments
for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split('=');
    switch (key) {
        case '--content-dir': config.contentDir = value; break;
        case '--output': config.output = value; break;
        case '--site-name': config.siteName = value; break;
        case '--site-domain': config.siteDomain = value; break;
        case '--site-description': config.siteDescription = value; break;
        case '--tool-prefix': config.toolPrefix = value; break;
        case '--help':
        case '-h':
            console.log(`
Hugo Search Index Generator

Usage:
  node generate-index.js [options]

Options:
  --content-dir=PATH      Hugo content directory (default: ./content)
  --output=PATH           Output file (default: ./public/search-index.json)
  --site-name=NAME        Site name for MCP branding
  --site-domain=DOMAIN    Site domain
  --site-description=DESC Site description
  --tool-prefix=PREFIX    Tool name prefix

Environment Variables:
  CONTENT_DIR, OUTPUT, SITE_NAME, SITE_DOMAIN, SITE_DESCRIPTION, TOOL_PREFIX
`);
            process.exit(0);
    }
}

/**
 * Parse TOML frontmatter (Hugo's default)
 */
function parseTOMLFrontmatter(content) {
    const match = content.match(/^\+\+\+\n([\s\S]*?)\n\+\+\+\n([\s\S]*)$/);
    if (!match) return null;

    const frontmatter = {};
    for (const line of match[1].split('\n')) {
        const m = line.match(/^(\w+)\s*=\s*(.+)$/);
        if (m) {
            let value = m[2].trim();
            // Handle arrays
            if (value.startsWith('[')) {
                value = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
            }
            // Handle strings
            else if (value.startsWith('"') || value.startsWith("'")) {
                value = value.slice(1, -1);
            }
            // Handle booleans
            else if (value === 'true') value = true;
            else if (value === 'false') value = false;

            frontmatter[m[1]] = value;
        }
    }
    return { frontmatter, body: match[2] };
}

/**
 * Parse YAML frontmatter
 */
function parseYAMLFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;

    const frontmatter = {};
    for (const line of match[1].split('\n')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();

            if (value.startsWith('[')) {
                value = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
            } else if (value.startsWith('"') || value.startsWith("'")) {
                value = value.slice(1, -1);
            } else if (value === 'true') value = true;
            else if (value === 'false') value = false;

            frontmatter[key] = value;
        }
    }
    return { frontmatter, body: match[2] };
}

/**
 * Parse frontmatter (tries TOML then YAML)
 */
function parseFrontmatter(content) {
    return parseTOMLFrontmatter(content) || parseYAMLFrontmatter(content) || { frontmatter: {}, body: content };
}

/**
 * Convert Hugo file path to URL
 */
function hugoPathToUrl(filePath, contentDir) {
    let url = '/' + relative(contentDir, filePath)
        .replace(/\\/g, '/')
        .replace(/\.md$/, '')
        .replace(/\/_index$/, '')
        .replace(/\/index$/, '');

    // Handle section _index.md files
    if (basename(filePath) === '_index.md') {
        url = '/' + dirname(relative(contentDir, filePath)).replace(/\\/g, '/');
    }

    return url === '/.' ? '/' : url;
}

/**
 * Find all markdown files recursively
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
 * Process a markdown file
 */
function processFile(filePath, contentDir) {
    const content = readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    // Skip drafts
    if (frontmatter.draft === true) {
        return null;
    }

    const url = hugoPathToUrl(filePath, contentDir);

    return {
        url,
        title: frontmatter.title || basename(filePath, '.md'),
        abstract: frontmatter.description || frontmatter.summary || '',
        date: frontmatter.date || '',
        topics: frontmatter.tags || frontmatter.categories || [],
        body: body.trim(),
    };
}

// Main
console.log(`Scanning ${config.contentDir} for Hugo content...`);

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
console.log(`Generated index with ${pages.length} pages (${skipped} drafts skipped)`);
console.log(`Output: ${config.output}`);
