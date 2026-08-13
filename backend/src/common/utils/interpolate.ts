/** Replaces `{token}` placeholders in admin-editable email copy (R166) with real values. */
export function interpolate(template: string, context?: Record<string, string | number>): string {
  if (!context) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    context[key] !== undefined ? String(context[key]) : match,
  );
}
