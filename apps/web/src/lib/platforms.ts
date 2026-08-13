// Mock platform catalog shared by the landing page and the explorer sidebar.
// TODO: replace with `await fetch("/api/v1/platforms")` once the API is live.

export interface PlatformSummary {
  slug: string
  name: string
  abbrev: string
  log_count: number
  source_count: number
  technique_count: number
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
      { slug: "windows", name: "Windows", abbrev: "WIN", log_count: 1240, source_count: 8, technique_count: 284 },
      { slug: "linux", name: "Linux", abbrev: "LNX", log_count: 640, source_count: 12, technique_count: 198 },
      { slug: "macos", name: "macOS", abbrev: "MAC", log_count: 320, source_count: 5, technique_count: 143 },
    ],
  },
  {
    category: "cloud",
    label: "Cloud",
    platforms: [
      { slug: "aws", name: "AWS", abbrev: "AWS", log_count: 890, source_count: 15, technique_count: 201 },
      { slug: "azure", name: "Azure", abbrev: "AZ", log_count: 720, source_count: 12, technique_count: 178 },
      { slug: "gcp", name: "GCP", abbrev: "GCP", log_count: 480, source_count: 9, technique_count: 134 },
    ],
  },
  {
    category: "saas",
    label: "SaaS & Identity",
    platforms: [
      { slug: "okta", name: "Okta", abbrev: "OKT", log_count: 180, source_count: 2, technique_count: 67 },
      { slug: "m365", name: "Microsoft 365", abbrev: "M365", log_count: 420, source_count: 7, technique_count: 115 },
      { slug: "gsuite", name: "Google Workspace", abbrev: "GSW", log_count: 210, source_count: 4, technique_count: 72 },
    ],
  },
  {
    category: "network",
    label: "Network",
    platforms: [
      { slug: "firewall", name: "Firewall", abbrev: "FW", log_count: 290, source_count: 6, technique_count: 89 },
      { slug: "dns", name: "DNS", abbrev: "DNS", log_count: 140, source_count: 3, technique_count: 54 },
    ],
  },
]

export const ALL_PLATFORMS: PlatformSummary[] = PLATFORM_GROUPS.flatMap((g) => g.platforms)
