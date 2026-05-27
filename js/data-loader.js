export async function loadData() {
  const files = [
    ["movies", "data/web/movies.json?v=20260527-final8"],
    ["franchises", "data/web/franchises.json?v=20260527-final8"],
    ["directors", "data/web/directors.json?v=20260527-final8"],
    ["directorPortraits", "data/web/director_portraits.json?v=20260527-final8"],
    ["summary", "data/web/summary.json?v=20260527-final8"],
  ];

  const results = await Promise.all(
    files.map(async ([key, path]) => {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Unable to load ${path}: ${response.status}`);
      }
      return [key, await response.json()];
    }),
  );

  return Object.fromEntries(results);
}
