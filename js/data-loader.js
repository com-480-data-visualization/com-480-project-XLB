export async function loadData() {
  const files = [
    ["movies", "data/web/movies.json"],
    ["franchises", "data/web/franchises.json"],
    ["directors", "data/web/directors.json"],
    ["summary", "data/web/summary.json"],
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
