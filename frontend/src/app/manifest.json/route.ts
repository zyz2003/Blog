import { NextResponse } from "next/server";
import { parseAppearanceTokensJson } from "@/lib/theme/appearance-resolve";
import { fetchSiteConfigForSeo, resolveSeoSiteInfo } from "@/lib/seo";

const DEFAULT_THEME_COLOR = "#163bf2";
const DEFAULT_BACKGROUND_COLOR = "#f7f9fe";

export const dynamic = "force-dynamic";

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function resolveShortName(name: string): string {
    const compact = name.replace(/\s+/g, "").trim();
    return compact.length > 12 ? compact.slice(0, 12) : compact;
}

function resolveThemeColor(tokens: unknown): string {
    const parsed = parseAppearanceTokensJson(tokens);
    const primary = parsed.light?.primary;
    return isNonEmptyString(primary) ? primary : DEFAULT_THEME_COLOR;
}

export async function GET() {
    const siteConfig = await fetchSiteConfigForSeo();
    const site = resolveSeoSiteInfo(siteConfig);

    const name = site.siteName;
    const shortName = resolveShortName(site.siteName);
    const description = site.description;

    const icon192 =
        (isNonEmptyString(siteConfig?.LOGO_URL_192x192) && siteConfig.LOGO_URL_192x192) ||
        (isNonEmptyString(siteConfig?.LOGO_URL) && siteConfig.LOGO_URL) ||
        "/static/img/logo-192x192.png";

    const icon512 =
        (isNonEmptyString(siteConfig?.LOGO_URL_512x512) && siteConfig.LOGO_URL_512x512) ||
        (isNonEmptyString(siteConfig?.LOGO_URL) && siteConfig.LOGO_URL) ||
        "/static/img/logo-512x512.png";

    const manifest = {
        name,
        short_name: shortName,
        description,
        start_url: "/",
        display: "standalone",
        background_color: DEFAULT_BACKGROUND_COLOR,
        theme_color: resolveThemeColor(siteConfig?.APPEARANCE_TOKENS),
        icons: [
            {
                src: icon192,
                sizes: "192x192",
                type: "image/png",
                purpose: "any maskable",
            },
            {
                src: icon512,
                sizes: "512x512",
                type: "image/png",
                purpose: "any maskable",
            },
        ],
    };

    return NextResponse.json(manifest, {
        headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "no-store, max-age=0",
        },
    });
}