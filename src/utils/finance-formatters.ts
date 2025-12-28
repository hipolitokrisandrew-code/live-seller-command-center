// finance-formatters.ts
const CURRENCY_SYMBOL = "₱";
const LABEL_ELLIPSIS = "...";

function toNumber(value: number | null | undefined) {
  return Number.isFinite(value as number) ? (value as number) : 0;
}

function truncateWord(word: string, maxChars: number) {
  if (word.length <= maxChars) return word;
  if (maxChars <= LABEL_ELLIPSIS.length) return LABEL_ELLIPSIS;
  return `${word.slice(0, maxChars - LABEL_ELLIPSIS.length)}${LABEL_ELLIPSIS}`;
}

function ensureMaxChars(maxChars: number) {
  return Math.max(1, Math.floor(maxChars));
}

export function formatCurrencyPHP(value: number | null | undefined): string {
  const num = toNumber(value);
  return `${CURRENCY_SYMBOL}${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: number | null | undefined): string {
  const num = toNumber(value);
  const hasFraction = Math.abs(num % 1) > 1e-9;
  const decimals = hasFraction ? 1 : 0;
  return `${num.toFixed(decimals)}%`;
}

/**
 * Returns a label formatted for chart axes.
 * - Wraps on spaces up to maxLines
 * - Enforces maxChars per line
 * - Adds ellipsis when truncated
 * - Returns a single string joined with "\n" between lines (use custom ticks to render tspans)
 */
export function formatCompactLabel(
  text: unknown,
  maxChars = 12,
  maxLines = 2
): string {
  const normalized = typeof text === "string" ? text : String(text ?? "");
  const label = normalized.trim() || "(Unnamed)";

  const limit = ensureMaxChars(maxChars);
  const lineLimit = Math.max(1, Math.floor(maxLines));

  const words = label.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  const pushLine = (line: string) => {
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
  };

  for (const word of words) {
    if (lines.length >= lineLimit) break;

    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length > limit) {
      if (currentLine) {
        pushLine(currentLine);
        currentLine = word;
      } else {
        pushLine(truncateWord(word, limit));
        currentLine = "";
      }
    } else {
      currentLine = candidate;
    }
  }

  if (lines.length < lineLimit && currentLine) {
    pushLine(currentLine);
  }

  if (lines.length === 0) {
    pushLine(truncateWord(label, limit));
  }

  const maxAvailableChars = limit * lineLimit;
  const needsEllipsis = label.length > maxAvailableChars;

  const finalLines = lines.slice(0, lineLimit).map((line, index, arr) => {
    const trimmed = line.trim();
    if (trimmed.length > limit) return truncateWord(trimmed, limit);
    if (needsEllipsis && index === arr.length - 1)
      return truncateWord(trimmed, limit);
    return trimmed;
  });

  return finalLines.join("\n");
}
