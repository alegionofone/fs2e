export function tagifyValue(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value === null || value === undefined) return "[]";
  if (typeof value === "string") return JSON.stringify(value.split(",").map(v => v.trim()).filter(Boolean));
  return JSON.stringify(value);
}
