import { z } from "zod";

/**
 * Site metadata for MCP server branding and configuration.
 * This information is read from the search index and used to dynamically
 * configure tool names, descriptions, and URL generation.
 */
export interface SiteMetadata {
	/** Human-readable site name (e.g., "Lenny Zeltser's Website") */
	name: string;
	/** Site domain without protocol (e.g., "zeltser.com", "docs.remnux.org") */
	domain: string;
	/** Brief description of site content (optional) */
	description?: string;
	/** Custom prefix for tool names (e.g., "zeltser" -> "search_zeltser"). If not set, uses "website". */
	toolPrefix?: string;
}

/**
 * A single page/article in the search index.
 */
export interface SearchPage {
	/** URL path relative to domain (e.g., "/about", "/tools/capa") */
	url: string;
	/** Page title */
	title: string;
	/** Brief summary/description (optional) */
	abstract?: string;
	/** Publication date in YYYY-MM-DD format (optional) */
	date?: string;
	/** Tags/categories (optional) */
	topics?: string[];
	/** Full content text for search and retrieval (optional but recommended) */
	body?: string;
}

/**
 * The complete search index structure.
 * Version 3.0 adds the `site` metadata object.
 */
export interface SearchIndex {
	/** Schema version (e.g., "3.0") */
	version: string;
	/** ISO 8601 timestamp when index was generated */
	generated: string;
	/** Site metadata for branding and configuration */
	site: SiteMetadata;
	/** Total number of pages in the index */
	pageCount: number;
	/** Array of indexed pages */
	pages: SearchPage[];
}

// Zod schemas for runtime validation

export const SiteMetadataSchema = z.object({
	name: z.string().min(1, "Site name is required"),
	domain: z.string().min(1, "Site domain is required"),
	description: z.string().optional(),
	toolPrefix: z
		.string()
		.regex(/^[a-z][a-z0-9_]*$/, "Tool prefix must be lowercase alphanumeric with underscores, starting with a letter")
		.optional(),
});

export const SearchPageSchema = z.object({
	url: z.string().startsWith("/", "URL must start with /"),
	title: z.string().min(1, "Title is required"),
	abstract: z.string().optional().default(""),
	date: z.string().optional().default(""),
	topics: z.array(z.string()).optional().default([]),
	body: z.string().optional(),
});

export const SearchIndexSchema = z.object({
	version: z.string().min(1, "Version is required"),
	generated: z.string().min(1, "Generated timestamp is required"),
	site: SiteMetadataSchema,
	pageCount: z.number().int().nonnegative(),
	pages: z.array(SearchPageSchema),
});

/**
 * Helper to get the tool prefix from site metadata.
 * Returns the custom toolPrefix if set, otherwise "website".
 */
export function getToolPrefix(site: SiteMetadata): string {
	return site.toolPrefix || "website";
}

/**
 * Generate full URL from domain and path.
 */
export function getFullUrl(site: SiteMetadata, path: string): string {
	return `https://${site.domain}${path}`;
}
