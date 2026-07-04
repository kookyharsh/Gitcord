export function filterProtected(
  items: { type: string; id: string }[],
  protectedIds: string[],
): { type: string; id: string }[] {
  const protectedSet = new Set(protectedIds);
  return items.filter(item => !protectedSet.has(item.id));
}
