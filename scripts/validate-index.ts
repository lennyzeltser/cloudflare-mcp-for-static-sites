#!/usr/bin/env bun
/**
 * Search Index Validator
 *
 * Validates a search index file against the v3.0 schema.
 *
 * Usage:
 *   bun scripts/validate-index.ts path/to/search-index.json
 */

import { SearchIndexSchema } from "../src/types";

async function main() {
	const args = process.argv.slice(2);

	if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
		console.log(`
Search Index Validator

Usage:
  bun scripts/validate-index.ts <index-file>

Example:
  bun scripts/validate-index.ts search-index.json
`);
		process.exit(args.length === 0 ? 1 : 0);
	}

	const filePath = args[0];

	try {
		const file = Bun.file(filePath);
		if (!(await file.exists())) {
			console.error(`Error: File not found: ${filePath}`);
			process.exit(1);
		}

		const data = await file.json();
		const result = SearchIndexSchema.safeParse(data);

		if (!result.success) {
			console.error("Validation failed:\n");
			for (const issue of result.error.issues) {
				console.error(`  ${issue.path.join(".")}: ${issue.message}`);
			}
			process.exit(1);
		}

		const index = result.data;

		// Additional checks
		const warnings: string[] = [];

		// Check for pages without body content
		const pagesWithoutBody = index.pages.filter((p) => !p.body || p.body.length === 0);
		if (pagesWithoutBody.length > 0) {
			warnings.push(`${pagesWithoutBody.length} pages have no body content (search quality may be reduced)`);
		}

		// Check for duplicate URLs
		const urls = new Set<string>();
		const duplicates: string[] = [];
		for (const page of index.pages) {
			if (urls.has(page.url)) {
				duplicates.push(page.url);
			}
			urls.add(page.url);
		}
		if (duplicates.length > 0) {
			warnings.push(`Duplicate URLs found: ${duplicates.join(", ")}`);
		}

		// Check pageCount matches
		if (index.pageCount !== index.pages.length) {
			warnings.push(`pageCount (${index.pageCount}) doesn't match actual pages (${index.pages.length})`);
		}

		// Output
		console.log("✓ Valid search index\n");
		console.log(`  Version:     ${index.version}`);
		console.log(`  Generated:   ${index.generated}`);
		console.log(`  Site:        ${index.site.name} (${index.site.domain})`);
		console.log(`  Tool prefix: ${index.site.toolPrefix || "(default: website)"}`);
		console.log(`  Pages:       ${index.pages.length}`);

		if (warnings.length > 0) {
			console.log("\nWarnings:");
			for (const warning of warnings) {
				console.log(`  ⚠ ${warning}`);
			}
		}
	} catch (error) {
		if (error instanceof SyntaxError) {
			console.error(`Error: Invalid JSON in ${filePath}`);
		} else {
			console.error(`Error: ${error}`);
		}
		process.exit(1);
	}
}

main();
