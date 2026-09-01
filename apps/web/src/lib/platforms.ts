// Catálogo de plataformas que cubre el producto: identidad, nada más.
//
// Los conteos por plataforma se han quitado de aquí. Los que había —1.240 logs
// para Windows, 890 para AWS…— eran inventados, y quien los leía no tenía forma
// de saberlo. `PlatformSidebar` ya los retiró por lo mismo cuando pasó a leer
// las plataformas de la API. Volverán cuando exista un endpoint que los sirva.
//
// TODO: sustituir por `await api.platforms.list()` cuando exista /platforms.

export interface PlatformSummary {
  slug: string
  name: string
  abbrev: string
}

export interface PlatformGroup {
  category: "os" | "cloud" | "saas" | "network"
  label: string
  platforms: PlatformSummary[]
}

export const PLATFORM_GROUPS: PlatformGroup[] = [
  {
    category: "os",
    label: "Operating Systems",
    platforms: [
      { slug: "windows", name: "Windows", abbrev: "WIN" },
      { slug: "linux", name: "Linux", abbrev: "LNX" },
      { slug: "macos", name: "macOS", abbrev: "MAC" },
    ],
  },
  {
    category: "cloud",
    label: "Cloud",
    platforms: [
      { slug: "aws", name: "AWS", abbrev: "AWS" },
      { slug: "azure", name: "Azure", abbrev: "AZ" },
      { slug: "gcp", name: "GCP", abbrev: "GCP" },
    ],
  },
  {
    category: "saas",
    label: "SaaS & Identity",
    platforms: [
      { slug: "okta", name: "Okta", abbrev: "OKT" },
      { slug: "m365", name: "Microsoft 365", abbrev: "M365" },
      { slug: "gsuite", name: "Google Workspace", abbrev: "GSW" },
    ],
  },
  {
    category: "network",
    label: "Network",
    platforms: [
      { slug: "firewall", name: "Firewall", abbrev: "FW" },
      { slug: "dns", name: "DNS", abbrev: "DNS" },
    ],
  },
]

export const ALL_PLATFORMS: PlatformSummary[] = PLATFORM_GROUPS.flatMap((g) => g.platforms)
