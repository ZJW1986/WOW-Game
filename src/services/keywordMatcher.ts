export function buildKeywordMatcher(keywords: string[]): (text: string) => boolean {
  const normalized = keywords
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
  return (text: string) => {
    const value = text.toLowerCase();
    return normalized.some((keyword) => value.includes(keyword));
  };
}
