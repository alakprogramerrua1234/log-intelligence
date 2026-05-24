// Mock data used when USE_MOCK = true in LogTableClient.tsx.
// Replace calls to this module with real API calls when the backend is ready.

import type { FilterCategory, Log, PaginatedLogs } from "@/lib/types"

export const MOCK_FILTER_CATEGORIES: FilterCategory[] = [
  { key: "platform",     label: "Platform",     source_table: "platform",     value_column: "name", detection_fk: "platform_id",     value_type: "enum",   ui_hint: "dropdown",    order: 1, enabled: true },
  { key: "log_source",   label: "Log Source",   source_table: "log_source",   value_column: "name", detection_fk: "log_source_id",   value_type: "string", ui_hint: "multiselect", order: 2, enabled: true },
  { key: "event_id",     label: "Event ID",     source_table: "event_id",     value_column: "name", detection_fk: "event_id_id",     value_type: "string", ui_hint: "multiselect", order: 3, enabled: true },
  { key: "tactic",       label: "Tactic",       source_table: "tactic",       value_column: "name", detection_fk: "tactic_id",       value_type: "enum",   ui_hint: "chip",        order: 4, enabled: true },
  { key: "technique",    label: "Technique",    source_table: "technique",    value_column: "id",   detection_fk: "technique_id",    value_type: "string", ui_hint: "multiselect", order: 5, enabled: true },
  { key: "subtechnique", label: "Sub-technique",source_table: "subtechnique", value_column: "id",   detection_fk: "subtechnique_id", value_type: "string", ui_hint: "multiselect", order: 6, enabled: true },
]

const MOCK_LOGS: Log[] = [
  {
    id: "a1b2c3d4-0001",
    log_source_id: "src-sysmon",
    log_source_name: "Sysmon",
    event_id: "1",
    name: "Process Creation",
        provider: "Microsoft-Windows-Sysmon",
    description: "Captures process creation events including full command line and parent process.",
    sample_fields: { Image: "C:\\Windows\\System32\\cmd.exe", CommandLine: "cmd.exe /c whoami", ParentImage: "C:\\Windows\\explorer.exe" },
    relevance: 92,
    techniques: [
      { technique_id: "T1059", technique_name: "Command and Scripting Interpreter", id: "T1059.003", name: "Windows Command Shell",  tactic: ["execution"], confidence: 90 },
      { technique_id: "T1106", technique_name: "Native API",                        id: "T1106",     name: "Native API",            tactic: ["execution"], confidence: 60 },
    ],
  },
  {
    id: "a1b2c3d4-0002",
    log_source_id: "src-sysmon",
    log_source_name: "Sysmon",
    event_id: "3",
    name: "Network Connection",
        provider: "Microsoft-Windows-Sysmon",
    description: "Logs outbound TCP/UDP connections with source and destination details.",
    sample_fields: { DestinationIp: "192.168.1.1", DestinationPort: "443", Protocol: "tcp" },
    relevance: 78,
    techniques: [
      { technique_id: "T1071", technique_name: "Application Layer Protocol", id: "T1071.001", name: "Web Protocols",        tactic: ["command-and-control"], confidence: 75 },
      { technique_id: "T1041", technique_name: "Exfiltration Over C2",       id: "T1041",     name: "Exfiltration Over C2", tactic: ["exfiltration"],        confidence: 50 },
    ],
  },
  {
    id: "a1b2c3d4-0003",
    log_source_id: "src-security",
    log_source_name: "Windows Security",
    event_id: "4624",
    name: "An account was successfully logged on",
    provider: "Microsoft-Windows-Security-Auditing",
    description: "Generates when a logon session is created. Includes logon type, subject, and account name.",
    sample_fields: { LogonType: "3", TargetUserName: "administrator", IpAddress: "10.0.0.5" },
    relevance: 85,
    techniques: [
      { technique_id: "T1078", technique_name: "Valid Accounts",   id: "T1078", name: "Valid Accounts",  tactic: ["defense-evasion", "persistence", "privilege-escalation", "initial-access"], confidence: 80 },
      { technique_id: "T1021", technique_name: "Remote Services",  id: "T1021", name: "Remote Services", tactic: ["lateral-movement"], confidence: 65 },
    ],
  },
  {
    id: "a1b2c3d4-0004",
    log_source_id: "src-security",
    log_source_name: "Windows Security",
    event_id: "4625",
    name: "An account failed to log on",
    provider: "Microsoft-Windows-Security-Auditing",
    description: "Records failed logon attempts. Useful for detecting brute-force activity.",
    sample_fields: { TargetUserName: "administrator", LogonType: "3", SubStatus: "0xC000006A" },
    relevance: 72,
    techniques: [
      { technique_id: "T1110", technique_name: "Brute Force", id: "T1110", name: "Brute Force", tactic: ["credential-access"], confidence: 88 },
    ],
  },
  {
    id: "a1b2c3d4-0005",
    log_source_id: "src-sysmon",
    log_source_name: "Sysmon",
    event_id: "7",
    name: "Image Loaded",
        provider: "Microsoft-Windows-Sysmon",
    description: "Logs DLL load events. High noise — typically filtered to unsigned or untrusted images.",
    sample_fields: { ImageLoaded: "C:\\Temp\\evil.dll", Signed: "false", Signature: "" },
    relevance: 65,
    techniques: [
      { technique_id: "T1574", technique_name: "Hijack Execution Flow", id: "T1574.001", name: "DLL Search Order Hijacking", tactic: ["persistence", "privilege-escalation", "defense-evasion"], confidence: 70 },
    ],
  },
  {
    id: "a1b2c3d4-0006",
    log_source_id: "src-sysmon",
    log_source_name: "Sysmon",
    event_id: "11",
    name: "FileCreate",
        provider: "Microsoft-Windows-Sysmon",
    description: "Captures file creation events including the process that created the file.",
    sample_fields: { TargetFilename: "C:\\Users\\Public\\payload.exe", CreationUtcTime: "2026-05-09 08:12:00.000" },
    relevance: 58,
    techniques: [
      { technique_id: "T1105", technique_name: "Ingress Tool Transfer", id: "T1105", name: "Ingress Tool Transfer", tactic: ["command-and-control"], confidence: 65 },
    ],
  },
  {
    id: "a1b2c3d4-0007",
    log_source_id: "src-powershell",
    log_source_name: "PowerShell",
    event_id: "4104",
    name: "Script Block Logging",
    provider: "Microsoft-Windows-PowerShell",
    description: "Records the content of PowerShell script blocks as they are executed.",
    sample_fields: { ScriptBlockText: "Invoke-Mimikatz -DumpCreds", ScriptBlockId: "abc-123" },
    relevance: 95,
    techniques: [
      { technique_id: "T1059", technique_name: "Command and Scripting Interpreter", id: "T1059.001", name: "PowerShell",   tactic: ["execution"],         confidence: 95 },
      { technique_id: "T1003", technique_name: "OS Credential Dumping",             id: "T1003.001", name: "LSASS Memory", tactic: ["credential-access"], confidence: 85 },
    ],
  },
  {
    id: "a1b2c3d4-0008",
    log_source_id: "src-security",
    log_source_name: "Windows Security",
    event_id: "4688",
    name: "A new process has been created",
    provider: "Microsoft-Windows-Security-Auditing",
    description: "Logs process creation when process auditing is enabled. Less detail than Sysmon Event 1.",
    sample_fields: { NewProcessName: "C:\\Windows\\System32\\net.exe", CommandLine: "net user /domain" },
    relevance: 70,
    techniques: [
      { technique_id: "T1087", technique_name: "Account Discovery",             id: "T1087.002", name: "Domain Account",       tactic: ["discovery"],   confidence: 72 },
      { technique_id: "T1059", technique_name: "Command and Scripting Interpreter", id: "T1059.003", name: "Windows Command Shell", tactic: ["execution"], confidence: 60 },
    ],
  },
]

export function getMockLogs(filters: Record<string, string[]>, q: string): PaginatedLogs {
  let items = [...MOCK_LOGS]

  if (q) {
    const lower = q.toLowerCase()
    items = items.filter(
      (l) =>
        l.name.toLowerCase().includes(lower) ||
        l.event_id?.includes(lower) ||
        l.description?.toLowerCase().includes(lower),
    )
  }

  if (filters.log_source?.length) {
    items = items.filter((l) => filters.log_source.includes(l.log_source_name))
  }

  if (filters.tactic?.length) {
    items = items.filter((l) =>
      l.techniques.some((t) => t.tactic.some((tac) => filters.tactic.includes(tac))),
    )
  }

  if (filters.event_id?.length) {
    items = items.filter((l) => l.event_id && filters.event_id.includes(l.event_id))
  }

  return { items, next_cursor: null, total: items.length }
}
