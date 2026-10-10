interface WebCitation {
  type: string;
  start_index?: number;
  end_index?: number;
  title?: string;
  url?: string;
}

// Store portable Markdown so citations also survive reloads, copy and export.
export function citeText(text: string, annotations: WebCitation[]) {
  let result = text;
  let boundary = text.length;
  const citations = annotations
    .filter((a) => a.type === "url_citation")
    .sort((a, b) => (b.start_index ?? -1) - (a.start_index ?? -1));
  for (const citation of citations) {
    const { start_index: start, end_index: end, url, title } = citation;
    if (
      start === undefined ||
      end === undefined ||
      !url ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < start ||
      end > boundary
    )
      continue;
    try {
      const parsed = new URL(url);
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
      )
        continue;
      const label = (title || parsed.hostname)
        .replace(/[\\[\]<>\r\n]/g, " ")
        .trim();
      const href = parsed.href.replace(
        /[()<>]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      );
      result =
        result.slice(0, start) + ` [${label}](<${href}>)` + result.slice(end);
      boundary = start;
    } catch {
      /* Ignore malformed provider URLs. */
    }
  }
  return result;
}
