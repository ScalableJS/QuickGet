export interface HttpLogEntry {
  method: string;
  path: string;
  status: number;
  requestBody?: string;
  responseBody?: string;
}

const REDACTION_PATTERNS: [RegExp, string][] = [
  [/([?&]sid=)([^&\s]+)/gi, "$1<redacted>"],
  [/([?&]pass=)([^&\s]+)/gi, "$1<redacted>"],
  [/([?&]password=)([^&\s]+)/gi, "$1<redacted>"],
  [/([?&]token=)([^&\s]+)/gi, "$1<redacted>"],
  [/("sid"\s*:\s*")([^"]+)(")/gi, "$1<redacted>$3"],
  [/("pass"\s*:\s*")([^"]+)(")/gi, "$1<redacted>$3"],
  [/("password"\s*:\s*")([^"]+)(")/gi, "$1<redacted>$3"],
  [/("token"\s*:\s*")([^"]+)(")/gi, "$1<redacted>$3"],
  [/("name"\s*:\s*"sid"\s*,\s*"value"\s*:\s*")([^"]+)(")/gi, "$1<redacted>$3"],
  [/("name"\s*:\s*"pass"\s*,\s*"value"\s*:\s*")([^"]+)(")/gi, "$1<redacted>$3"],
  [/("name"\s*:\s*"password"\s*,\s*"value"\s*:\s*")([^"]+)(")/gi, "$1<redacted>$3"],
  [/("name"\s*:\s*"token"\s*,\s*"value"\s*:\s*")([^"]+)(")/gi, "$1<redacted>$3"],
  [/(name="sid"\r?\n\r?\n)(.*?)(\r?\n--)/gis, "$1<redacted>$3"],
  [/(name="pass"\r?\n\r?\n)(.*?)(\r?\n--)/gis, "$1<redacted>$3"],
  [/(name="password"\r?\n\r?\n)(.*?)(\r?\n--)/gis, "$1<redacted>$3"],
];

function redact(value: string | undefined): string {
  if (!value) return "";
  return REDACTION_PATTERNS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value);
}

export class RedactedHttpLog {
  private readonly entries: HttpLogEntry[] = [];

  add(entry: HttpLogEntry): void {
    this.entries.push({
      ...entry,
      requestBody: redact(entry.requestBody),
      responseBody: redact(entry.responseBody),
    });
  }

  toText(): string {
    return this.entries
      .map((entry, index) =>
        [
          `#${index + 1} ${entry.method} ${entry.path} -> ${entry.status}`,
          entry.requestBody ? `request:\n${entry.requestBody}` : "request: <empty>",
          entry.responseBody ? `response:\n${entry.responseBody}` : "response: <empty>",
        ].join("\n"),
      )
      .join("\n\n");
  }

  toJSON(): HttpLogEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  mergeRequestBodies(replacements: Pick<HttpLogEntry, "method" | "path" | "requestBody">[]): void {
    let startIndex = 0;

    for (const replacement of replacements) {
      if (!replacement.requestBody) continue;

      for (let index = startIndex; index < this.entries.length; index += 1) {
        const entry = this.entries[index];
        if (entry.method !== replacement.method || entry.path !== replacement.path) {
          continue;
        }

        entry.requestBody = redact(replacement.requestBody);
        startIndex = index + 1;
        break;
      }
    }
  }

  includesPath(fragment: string): boolean {
    return this.entries.some((entry) => entry.path.includes(fragment));
  }
}
