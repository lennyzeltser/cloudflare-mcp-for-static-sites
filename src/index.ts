import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import Fuse from "fuse.js";
import type { SearchIndex, SearchPage, SiteMetadata } from "./types";
import { getToolPrefix, getFullUrl } from "./types";

// Environment bindings (from wrangler.jsonc)
interface Env extends Cloudflare.Env {
	SEARCH_BUCKET: R2Bucket;
}

// Configuration
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const R2_INDEX_KEY = "search-index.json";

// Cache for the search index
let cachedIndex: SearchIndex | null = null;
let cacheTimestamp = 0;

/**
 * Fetch and cache the search index from R2 bucket.
 * Supports both v2.x (no site metadata) and v3.x (with site metadata) formats.
 */
async function getSearchIndex(bucket: R2Bucket): Promise<SearchIndex> {
	const now = Date.now();

	// Return cached index if still valid
	if (cachedIndex && now - cacheTimestamp < CACHE_TTL_MS) {
		return cachedIndex;
	}

	// Fetch from R2 bucket
	const object = await bucket.get(R2_INDEX_KEY);
	if (!object) {
		throw new Error(`Search index not found in R2 bucket: ${R2_INDEX_KEY}`);
	}

	const data = (await object.json()) as SearchIndex;

	// Backward compatibility: add default site metadata if missing (v2.x indexes)
	if (!data.site) {
		(data as SearchIndex).site = {
			name: "Website",
			domain: "example.com",
			description: "Search this website",
		};
	}

	cachedIndex = data;
	cacheTimestamp = now;
	return cachedIndex;
}

/**
 * Search the index using Fuse.js for fuzzy matching.
 * Searches across title, abstract, body content, and topics.
 */
function searchPages(index: SearchIndex, query: string, limit: number): SearchPage[] {
	const fuse = new Fuse(index.pages, {
		keys: [
			{ name: "title", weight: 0.3 },
			{ name: "abstract", weight: 0.2 },
			{ name: "body", weight: 0.35 },
			{ name: "topics", weight: 0.15 },
		],
		threshold: 0.4,
		includeScore: true,
		ignoreLocation: true,
	});

	const results = fuse.search(query, { limit });
	return results.map((r) => r.item);
}

/**
 * Find a specific article by URL path.
 */
function findArticle(index: SearchIndex, url: string): SearchPage | undefined {
	const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
	const cleanUrl = normalizedUrl.endsWith("/") ? normalizedUrl.slice(0, -1) : normalizedUrl;
	return index.pages.find((page) => page.url === cleanUrl);
}

/**
 * Format search results for MCP response.
 */
function formatResults(results: SearchPage[], query: string, site: SiteMetadata): string {
	if (results.length === 0) {
		return `No articles found matching "${query}".`;
	}

	const lines = [`Found ${results.length} article(s) matching "${query}":\n`];

	for (const page of results) {
		lines.push(`**${page.title}**`);
		lines.push(`URL: ${getFullUrl(site, page.url)}`);
		if (page.date) {
			lines.push(`Date: ${page.date}`);
		}
		if (page.topics && page.topics.length > 0) {
			lines.push(`Topics: ${page.topics.join(", ")}`);
		}
		if (page.abstract) {
			const abstract = page.abstract.length > 200 ? `${page.abstract.substring(0, 200)}...` : page.abstract;
			lines.push(`Summary: ${abstract}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Format a single article for MCP response.
 */
function formatArticle(article: SearchPage, site: SiteMetadata): string {
	const lines = [`# ${article.title}`, "", `**URL:** ${getFullUrl(site, article.url)}`];

	if (article.date) {
		lines.push(`**Date:** ${article.date}`);
	}
	if (article.topics && article.topics.length > 0) {
		lines.push(`**Topics:** ${article.topics.join(", ")}`);
	}
	if (article.abstract) {
		lines.push(`**Summary:** ${article.abstract}`);
	}

	lines.push("", "---", "");

	if (article.body) {
		lines.push(article.body);
	} else {
		lines.push("(Full content not available)");
	}

	return lines.join("\n");
}

// Define our MCP agent with dynamically configured tools
export class SiteMCP extends McpAgent {
	server = new McpServer({
		name: "Static Site MCP Search",
		version: "3.0.0",
	});

	async init() {
		const bucket = (this.env as Env).SEARCH_BUCKET;

		// Load index to get site configuration
		const index = await getSearchIndex(bucket);
		const site = index.site;
		const toolPrefix = getToolPrefix(site);

		// Dynamically update server name based on site
		this.server = new McpServer({
			name: `${site.name} Search`,
			version: "3.0.0",
		});

		// Search tool - name includes site prefix for disambiguation
		const searchToolName = `search_${toolPrefix}`;
		const searchDescription = site.description
			? `Search ${site.name} by keywords. ${site.description}. Searches across titles, abstracts, full content, and topics.`
			: `Search ${site.name} by keywords. Searches across titles, abstracts, full content, and topics.`;

		this.server.tool(
			searchToolName,
			searchDescription,
			{
				query: z.string().describe("Search terms to find relevant content"),
				limit: z
					.number()
					.min(1)
					.max(MAX_LIMIT)
					.optional()
					.describe(`Maximum number of results to return (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})`),
			},
			async ({ query, limit }) => {
				try {
					const currentIndex = await getSearchIndex(bucket);
					const effectiveLimit = Math.min(limit || DEFAULT_LIMIT, MAX_LIMIT);
					const results = searchPages(currentIndex, query, effectiveLimit);
					const formatted = formatResults(results, query, currentIndex.site);

					return {
						content: [{ type: "text", text: formatted }],
					};
				} catch (error) {
					const message = error instanceof Error ? error.message : "Unknown error occurred";
					return {
						content: [{ type: "text", text: `Error searching: ${message}` }],
						isError: true,
					};
				}
			},
		);

		// Get article tool
		this.server.tool(
			"get_article",
			`Get the full content of a specific article from ${site.name} by URL path. Returns the complete article including title, date, topics, summary, and full body text.`,
			{
				url: z.string().describe("Article URL path (e.g., '/about', '/article-slug')"),
			},
			async ({ url }) => {
				try {
					const currentIndex = await getSearchIndex(bucket);
					const article = findArticle(currentIndex, url);

					if (!article) {
						return {
							content: [{ type: "text", text: `Article not found: ${url}` }],
							isError: true,
						};
					}

					return {
						content: [{ type: "text", text: formatArticle(article, currentIndex.site) }],
					};
				} catch (error) {
					const message = error instanceof Error ? error.message : "Unknown error occurred";
					return {
						content: [{ type: "text", text: `Error fetching article: ${message}` }],
						isError: true,
					};
				}
			},
		);

		// Index info tool
		this.server.tool(
			"get_index_info",
			`Get statistics about the ${site.name} search index including total pages indexed, last update time, and available tools.`,
			{},
			async () => {
				try {
					const currentIndex = await getSearchIndex(bucket);
					const currentSite = currentIndex.site;
					const prefix = getToolPrefix(currentSite);

					const info = [
						`**${currentSite.name} - MCP Search Index**`,
						`Domain: ${currentSite.domain}`,
						`Total pages: ${currentIndex.pageCount}`,
						`Index generated: ${currentIndex.generated}`,
						`Index version: ${currentIndex.version}`,
						"",
						"**Available tools:**",
						`- \`search_${prefix}\`: Search content by keywords`,
						"- `get_article`: Get full content of a specific article by URL",
						"",
					];

					if (currentSite.description) {
						info.push(currentSite.description);
					}

					return {
						content: [{ type: "text", text: info.join("\n") }],
					};
				} catch (error) {
					const message = error instanceof Error ? error.message : "Unknown error occurred";
					return {
						content: [{ type: "text", text: `Error fetching index info: ${message}` }],
						isError: true,
					};
				}
			},
		);
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// SSE transport (legacy, but still supported by many clients)
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return SiteMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		// Streamable HTTP transport (recommended)
		if (url.pathname === "/mcp") {
			return SiteMCP.serve("/mcp").fetch(request, env, ctx);
		}

		// Health check / info endpoint - dynamically reads site config
		if (url.pathname === "/" || url.pathname === "/health") {
			try {
				const index = await getSearchIndex(env.SEARCH_BUCKET);
				const site = index.site;
				const prefix = getToolPrefix(site);

				return new Response(
					JSON.stringify({
						name: `${site.name} MCP Search Server`,
						version: "3.0.0",
						site: {
							name: site.name,
							domain: site.domain,
							description: site.description,
						},
						endpoints: {
							sse: "/sse",
							mcp: "/mcp",
						},
						tools: [`search_${prefix}`, "get_article", "get_index_info"],
					}),
					{
						headers: { "Content-Type": "application/json" },
					},
				);
			} catch {
				return new Response(
					JSON.stringify({
						name: "Static Site MCP Search Server",
						version: "3.0.0",
						status: "error",
						error: "Search index not available",
					}),
					{
						status: 503,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		}

		return new Response("Not found", { status: 404 });
	},
};
