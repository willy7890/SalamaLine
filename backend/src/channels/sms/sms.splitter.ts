/** Splits long text into parts at line/word boundaries (never mid-word), max `limit` chars each, max `maxParts` parts. */
export function splitMessage(text: string, limit = 300, maxParts = 3): string[] {
  const parts: string[] = [];
  let current = '';
  for (const token of text.split(/(?<=\n)|(?<= )/)) {
    if ((current + token).length > limit && current) {
      parts.push(current.trimEnd());
      current = '';
    }
    current += token.length > limit ? token.slice(0, limit) : token;
  }
  if (current.trim()) parts.push(current.trimEnd());
  if (parts.length > maxParts) {
    const kept = parts.slice(0, maxParts);
    kept[maxParts - 1] = `${kept[maxParts - 1].slice(0, Math.max(0, limit - 1))}…`;
    return kept;
  }
  return parts;
}
