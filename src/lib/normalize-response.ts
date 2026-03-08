/**
 * Transforms API responses to replace `userStatuses` arrays with `userStatus` (singular).
 * This preserves backward compatibility with the frontend types after the schema
 * changed userStatus from a unique relation to a composite-unique array.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeUserStatuses(obj: any): any {
  if (Array.isArray(obj)) return obj.map(normalizeUserStatuses);
  // Only recurse into plain objects — leave Decimal, Date, etc. untouched
  if (obj && typeof obj === "object" && obj.constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === "userStatuses") {
        result["userStatus"] = Array.isArray(val) ? (val[0] ?? null) : null;
      } else {
        result[key] = normalizeUserStatuses(val);
      }
    }
    return result;
  }
  return obj;
}
