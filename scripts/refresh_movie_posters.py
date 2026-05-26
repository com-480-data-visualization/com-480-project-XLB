#!/usr/bin/env python3
"""Resolve current TMDb poster URLs for selected CineScope film evidence.

The downloaded metadata contains poster paths that may become stale after
TMDb image changes. By default this script resolves a curated set of
recognisable examples used during interaction; `--all` expands that set.
The cache is consumed by export_web_data.py.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import threading
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MOVIES_DATA = ROOT / "data" / "web" / "movies.json"
POSTER_CACHE = ROOT / "data" / "web" / "movie_posters.json"
USER_AGENT = "CineScope-EPFL/1.0 (academic visualization project)"
IMAGE_PATTERN = re.compile(
    r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"',
    re.IGNORECASE,
)
write_lock = threading.Lock()
CURATED_TITLES = {
    "Avatar",
    "Paranormal Activity",
    "Inception",
    "The Fate of the Furious",
    "The Dark Knight",
    "Titanic",
    "Jurassic Park",
    "E.T. the Extra-Terrestrial",
    "The Lord of the Rings: The Fellowship of the Ring",
    "The Lord of the Rings: The Two Towers",
    "The Lord of the Rings: The Return of the King",
    "Iron Man",
    "Iron Man 2",
    "Iron Man 3",
    "The Conjuring",
    "Saw",
    "Skyfall",
    "Beauty and the Beast",
    "Frozen",
}


def read_cache() -> dict[str, str | None]:
    if not POSTER_CACHE.exists():
        return {}
    with POSTER_CACHE.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_cache(cache: dict[str, str | None]) -> None:
    POSTER_CACHE.write_text(
        json.dumps(cache, separators=(",", ":"), sort_keys=True) + "\n",
        encoding="utf-8",
    )


def current_poster(movie_id: int) -> str | None:
    source = ""
    for _ in range(2):
        request = urllib.request.Request(
            f"https://www.themoviedb.org/movie/{movie_id}",
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.8"},
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                source = response.read().decode("utf-8", errors="ignore")
            break
        except (TimeoutError, urllib.error.URLError):
            continue
    match = IMAGE_PATTERN.search(source)
    if not match:
        return None
    url = html.unescape(match.group(1))
    if not url.startswith("https://media.themoviedb.org/"):
        return None
    return url.replace("/t/p/w500/", "/t/p/w185/")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=8, help="Concurrent TMDb page requests.")
    parser.add_argument("--all", action="store_true", help="Resolve all eligible films rather than the curated evidence set.")
    parser.add_argument("--limit", type=int, help="Resolve only this many uncached films for testing.")
    parser.add_argument("--refresh", action="store_true", help="Refresh URLs already stored in the cache.")
    args = parser.parse_args()

    with MOVIES_DATA.open(encoding="utf-8") as handle:
        movies: list[dict[str, Any]] = json.load(handle)
    cache = read_cache()
    candidates = movies if args.all else [movie for movie in movies if movie["title"] in CURATED_TITLES]
    if not args.all:
        cache = {str(movie["id"]): cache.get(str(movie["id"])) for movie in candidates if str(movie["id"]) in cache}
    queue = [
        (movie["id"], movie["title"])
        for movie in candidates
        if args.refresh or str(movie["id"]) not in cache
    ]
    if args.limit is not None:
        queue = queue[: args.limit]
    print(f"Resolving {len(queue):,} TMDb poster records ({len(cache):,} already cached).")
    completed = 0
    found = 0
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        tasks = {executor.submit(current_poster, movie_id): (movie_id, title) for movie_id, title in queue}
        for future in as_completed(tasks):
            movie_id, _ = tasks[future]
            poster_url = future.result()
            cache[str(movie_id)] = poster_url
            found += int(bool(poster_url))
            completed += 1
            if completed % 100 == 0:
                with write_lock:
                    write_cache(cache)
                print(f"  {completed:,}/{len(queue):,} resolved; {found:,} posters found.")
    write_cache(cache)
    print(f"Saved {POSTER_CACHE.relative_to(ROOT)}: {found:,}/{len(queue):,} new poster URLs found.")


if __name__ == "__main__":
    main()
