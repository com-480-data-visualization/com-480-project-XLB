#!/usr/bin/env python3
"""Fetch reusable Wikimedia Commons portraits for the director marquee.

The site only displays portraits for directors who can appear in the top-24
unfiltered marquee under its ranking controls. Missing or non-Commons images
are intentionally left to the interface's typographic fallback.
"""

from __future__ import annotations

import html
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DIRECTORS_DATA = ROOT / "data" / "web" / "directors.json"
OUTPUT_DATA = ROOT / "data" / "web" / "director_portraits.json"
OUTPUT_IMAGES = ROOT / "assets" / "images" / "directors"
ATTRIBUTION = OUTPUT_IMAGES / "ATTRIBUTION.md"

MINIMUM_FILM_OPTIONS = (4, 6, 10)
RANKING_FIELDS = ("medianRoi", "totalRevenue")
VISIBLE_ROWS = 24
USER_AGENT = "CineScope-EPFL/1.0 (academic data visualization; https://github.com/com-480-data-visualization/com-480-project-XLB)"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
ALIASES = {
    "Chris Columbus": "Chris Columbus (filmmaker)",
    "Guy Hamilton": "Guy Hamilton (director)",
    "John Glen": "John Glen (director)",
    "Terence Young": "Terence Young (director)",
}


def request_json(base_url: str, params: dict[str, str]) -> dict[str, Any]:
    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def clean_metadata(value: str | None) -> str:
    if not value:
        return ""
    plain = re.sub(r"<[^>]+>", "", value)
    return " ".join(html.unescape(plain).split())


def slug(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def selected_directors() -> list[str]:
    with DIRECTORS_DATA.open(encoding="utf-8") as handle:
        directors = json.load(handle)
    selected: set[str] = set()
    for minimum in MINIMUM_FILM_OPTIONS:
        eligible = [director for director in directors if director["filmCount"] >= minimum]
        for field in RANKING_FIELDS:
            ranked = sorted(eligible, key=lambda director: director[field], reverse=True)
            selected.update(director["name"] for director in ranked[:VISIBLE_ROWS])
    return sorted(selected)


def wikipedia_portrait(name: str) -> dict[str, str] | None:
    title = ALIASES.get(name, name)
    data = request_json(
        WIKIPEDIA_API,
        {
            "action": "query",
            "format": "json",
            "formatversion": "2",
            "redirects": "1",
            "prop": "pageimages",
            "piprop": "thumbnail|name",
            "pithumbsize": "420",
            "titles": title,
        },
    )
    page = data["query"]["pages"][0]
    thumbnail = page.get("thumbnail", {}).get("source")
    filename = page.get("pageimage")
    if not thumbnail or not filename or "/commons/" not in thumbnail:
        return None
    return {"thumbnail": thumbnail, "filename": filename, "article": page["title"]}


def commons_details(filename: str) -> dict[str, str] | None:
    data = request_json(
        COMMONS_API,
        {
            "action": "query",
            "format": "json",
            "formatversion": "2",
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "titles": f"File:{filename}",
        },
    )
    page = data["query"]["pages"][0]
    if "imageinfo" not in page:
        return None
    info = page["imageinfo"][0]
    metadata = info.get("extmetadata", {})
    return {
        "sourceUrl": info["descriptionurl"],
        "creator": clean_metadata(metadata.get("Artist", {}).get("value")) or "See source page",
        "license": clean_metadata(metadata.get("LicenseShortName", {}).get("value")) or "See source page",
        "licenseUrl": metadata.get("LicenseUrl", {}).get("value", info["descriptionurl"]),
    }


def download_portrait(source_url: str, destination: Path) -> None:
    request = urllib.request.Request(source_url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        image_bytes = response.read()
    with Image.open(BytesIO(image_bytes)) as source:
        image = source.convert("RGB")
        image.thumbnail((260, 340), Image.Resampling.LANCZOS)
        image.save(destination, "WEBP", quality=72, method=6)


def write_attribution(portraits: dict[str, dict[str, str]], missing: list[str]) -> None:
    lines = [
        "# Director portrait attribution",
        "",
        "Portraits shown in the CineScope director dossier are resized, unmodified thumbnails sourced from Wikimedia Commons. "
        "Each item retains its source-page and licence link in `data/web/director_portraits.json` and in the interface.",
        "",
        "| Director | Creator / attribution | Licence | Source |",
        "| --- | --- | --- | --- |",
    ]
    for name, portrait in sorted(portraits.items()):
        creator = portrait["creator"].replace("|", "/")
        lines.append(
            f"| {name} | {creator} | [{portrait['license']}]({portrait['licenseUrl']}) "
            f"| [Commons file]({portrait['sourceUrl']}) |"
        )
    lines.extend(
        [
            "",
            "No compliant Commons portrait was selected for: " + ", ".join(missing) + ".",
            "The website shows a generated typographic slate for these entries.",
            "",
        ]
    )
    ATTRIBUTION.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    OUTPUT_IMAGES.mkdir(parents=True, exist_ok=True)
    portraits: dict[str, dict[str, str]] = {}
    missing: list[str] = []
    for name in selected_directors():
        image = wikipedia_portrait(name)
        if not image:
            missing.append(name)
            continue
        details = commons_details(image["filename"])
        if not details:
            missing.append(name)
            continue
        destination = OUTPUT_IMAGES / f"{slug(name)}.webp"
        download_portrait(image["thumbnail"], destination)
        portraits[name] = {
            "src": destination.relative_to(ROOT).as_posix(),
            "sourceUrl": details["sourceUrl"],
            "creator": details["creator"],
            "license": details["license"],
            "licenseUrl": details["licenseUrl"],
        }
        time.sleep(0.05)

    OUTPUT_DATA.write_text(
        json.dumps(portraits, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    write_attribution(portraits, missing)
    print(f"Saved {len(portraits)} reusable director portraits; {len(missing)} entries use a slate fallback.")


if __name__ == "__main__":
    main()
