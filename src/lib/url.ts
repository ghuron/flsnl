export function withBase(path: string): string {
  if (path.startsWith("#") || /^https?:\/\//.test(path)) return path;
  return import.meta.env.BASE_URL + path.replace(/^\//, "");
}
