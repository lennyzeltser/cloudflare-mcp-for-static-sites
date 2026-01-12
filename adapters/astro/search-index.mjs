/**
 * Astro Integration: MCP Search Index Generator
 *
 * Generates a v3.0 MCP search index from Astro content collections at build time.
 *
 * Usage in astro.config.mjs:
 *
 *   import { searchIndexIntegration } from './integrations/search-index.mjs';
 *
 *   export default defineConfig({
 *     integrations: [
 *       searchIndexIntegration({
 *         siteName: 'My Blog',
 *         siteDomain: 'blog.example.com',
 *         toolPrefix: 'myblog',
 *         contentDir: 'src/content/posts',
 *       }),
 *     ],
 *   });
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative, basename } from 'path';
import { glob } from 'glob';

/**
 * Default configuration
 */
const defaults = {
    siteName: 'My Website',
    siteDomain: 'example.com',
    siteDescription: '',
    toolPrefix: 'website',
    contentDir: 'src/content',
    outputFile: 'dist/mcp-search-index.json',
    excludeSlugs: [],
    staticPages: [],
};

/**
 * Parse YAML-style frontmatter from markdown
 */
function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: content };

    const frontmatter = {};
    let currentKey = null;
    let currentValue = [];
    let inArray = false;

    for (const line of match[1].split('\n')) {
        // Array item
        if (line.match(/^\s+-\s+/)) {
            if (currentKey) {
                const value = line.replace(/^\s+-\s+/, '').replace(/^["']|["']$/g, '');
                currentValue.push(value);
            }
            continue;
        }

        // New key
        const keyMatch = line.match(/^(\w+):\s*(.*)/);
        if (keyMatch) {
            // Save previous key
            if (currentKey) {
                frontmatter[currentKey] = inArray ? currentValue : currentValue.join('');
            }

            currentKey = keyMatch[1];
            const value = keyMatch[2].trim();

            if (value === '' || value === '|' || value === '>') {
                currentValue = [];
                inArray = value === '';
            } else if (value.startsWith('[')) {
                // Inline array
                currentValue = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
                inArray = true;
            } else {
                currentValue = [value.replace(/^["']|["']$/g, '')];
                inArray = false;
            }
        }
    }

    // Save last key
    if (currentKey) {
        frontmatter[currentKey] = inArray ? currentValue : currentValue.join('');
    }

    return { frontmatter, body: match[2] };
}

/**
 * Create the Astro integration
 */
export function searchIndexIntegration(userConfig = {}) {
    const config = { ...defaults, ...userConfig };

    return {
        name: 'mcp-search-index',
        hooks: {
            'astro:build:done': async ({ dir }) => {
                console.log('Generating MCP search index...');

                const pages = [];
                const contentPath = join(process.cwd(), config.contentDir);

                // Find all markdown/mdx files
                const files = await glob('**/*.{md,mdx}', { cwd: contentPath });

                for (const file of files) {
                    const fullPath = join(contentPath, file);
                    const content = readFileSync(fullPath, 'utf-8');
                    const { frontmatter, body } = parseFrontmatter(content);

                    // Skip drafts
                    if (frontmatter.draft === 'true' || frontmatter.draft === true) {
                        continue;
                    }

                    // Generate URL from file path
                    const slug = file
                        .replace(/\.mdx?$/, '')
                        .replace(/\/index$/, '');

                    // Skip excluded slugs
                    if (config.excludeSlugs.includes(slug)) {
                        continue;
                    }

                    const url = '/' + slug;

                    pages.push({
                        url,
                        title: frontmatter.title || basename(file, '.md'),
                        abstract: frontmatter.description || frontmatter.summary || '',
                        date: frontmatter.date || frontmatter.pubDate || '',
                        topics: frontmatter.tags || frontmatter.topics || [],
                        body: body.trim(),
                    });
                }

                // Add static pages if configured
                for (const page of config.staticPages) {
                    if (page.file && existsSync(page.file)) {
                        const content = readFileSync(page.file, 'utf-8');
                        const { frontmatter, body } = parseFrontmatter(content);
                        pages.push({
                            url: page.url,
                            title: page.title || frontmatter.title || '',
                            abstract: page.abstract || frontmatter.description || '',
                            date: page.date || frontmatter.date || '',
                            topics: page.topics || frontmatter.tags || [],
                            body: body.trim(),
                        });
                    }
                }

                // Build index
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

                // Write to output
                const outputPath = join(dir.pathname, basename(config.outputFile));
                writeFileSync(outputPath, JSON.stringify(index, null, 2));
                console.log(`MCP search index generated: ${pages.length} pages → ${outputPath}`);
            },
        },
    };
}

export default searchIndexIntegration;
