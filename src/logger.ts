// One place that funnels caught errors to the console. Deliberately does not rethrow.
export function logError(context: string, error: unknown): void {
  console.error(`[${context}]`, error);
}
