export function toISODate(date: Date = new Date()): string {
  return date.toISOString().split("T")[0]!;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}
