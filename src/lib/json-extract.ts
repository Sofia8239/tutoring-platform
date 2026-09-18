/**
 * Best-effort extraction of a JSON value out of raw LLM text. Some models
 * (Gemini in particular) occasionally wrap otherwise-correct JSON in a
 * ```json fence or add a stray sentence before/after it, even when JSON mode
 * is requested — this recovers the JSON instead of failing outright.
 */
export function extractJsonText(raw: string): string {
  let text = raw.trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    text = fenced[1].trim();
  }

  // Already valid on its own — nothing more to do.
  try {
    JSON.parse(text);
    return text;
  } catch {
    // fall through to brace-matching below
  }

  // Slice from the first { or [ to the matching last } or ], to drop any
  // leading/trailing prose the model added around the JSON.
  const start = text.search(/[{[]/);
  if (start === -1) return text;
  const opening = text[start];
  const closing = opening === "{" ? "}" : "]";
  const end = text.lastIndexOf(closing);
  if (end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}
