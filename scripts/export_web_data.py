#!/usr/bin/env python3
"""Build compact browser datasets for the CineScope visualization."""

from __future__ import annotations

import argparse
import ast
import csv
import json
import math
import statistics
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
PROCESSED_MOVIES = ROOT / "data" / "processed" / "movies.csv"
RAW_METADATA = ROOT / "data" / "raw" / "movies_metadata.csv"
OUTPUT_DIR = ROOT / "data" / "web"
POSTER_CACHE = OUTPUT_DIR / "movie_posters.json"

BUDGET_FLOOR = 10_000
RATING_MIN_VOTES = 50
MIN_DIRECTOR_FILMS = 3

FOCUS_GENRES = [
    "Action",
    "Animation",
    "Comedy",
    "Drama",
    "Horror",
    "Science Fiction",
    "Thriller",
]
DISPLAY_GENRES = {
    "Science Fiction": "Sci-Fi",
}
IGNORED_PRIMARY_GENRES = {"Documentary", "Music", "TV Movie"}


def parse_list(value: str | None) -> list[Any]:
    if not value or value == "nan":
        return []
    try:
        parsed = ast.literal_eval(value)
    except (SyntaxError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


def number(value: str | None) -> float | None:
    try:
        result = float(value) if value else None
    except ValueError:
        return None
    return result if result is not None and math.isfinite(result) else None


def integer(value: str | None) -> int | None:
    result = number(value)
    return int(result) if result is not None else None


def rounded(value: float | None, digits: int = 3) -> float | None:
    return round(value, digits) if value is not None and math.isfinite(value) else None


def median(values: Iterable[float]) -> float | None:
    numbers = list(values)
    return statistics.median(numbers) if numbers else None


def display_genre(genre: str) -> str:
    return DISPLAY_GENRES.get(genre, genre)


def primary_genre(genres: list[str]) -> str:
    candidates = [genre for genre in genres if genre not in IGNORED_PRIMARY_GENRES]
    for genre in candidates:
        if genre in FOCUS_GENRES:
            return display_genre(genre)
    return "Other"


def budget_tier(budget: float) -> str:
    if budget < 5_000_000:
        return "Micro"
    if budget < 20_000_000:
        return "Low"
    if budget < 60_000_000:
        return "Mid"
    return "Blockbuster"


def roi_outcome(roi: float) -> str:
    if roi < 0.5:
        return "Flop"
    if roi < 2:
        return "Break-even"
    if roi <= 10:
        return "Hit"
    return "Megahit"


def financial_row(row: dict[str, str]) -> dict[str, Any] | None:
    movie_id = integer(row.get("id"))
    year = integer(row.get("year"))
    budget = number(row.get("budget"))
    revenue = number(row.get("revenue"))
    if (
        movie_id is None
        or year is None
        or year > 2017
        or budget is None
        or revenue is None
        or budget < BUDGET_FLOOR
        or revenue <= 0
    ):
        return None

    genres = [display_genre(genre) for genre in parse_list(row.get("genres_list"))]
    movie_genre = primary_genre([genre for genre in parse_list(row.get("genres_list"))])
    movie_roi = revenue / budget
    director = row.get("director") or ""
    top_cast = [str(person) for person in parse_list(row.get("top_cast"))[:3]]
    movielens_rating = number(row.get("movielens_avg_rating"))
    movielens_votes = integer(row.get("movielens_vote_count")) or 0
    tmdb_rating = number(row.get("vote_average"))
    tmdb_votes = integer(row.get("vote_count")) or 0

    return {
        "id": movie_id,
        "title": row.get("title", ""),
        "year": year,
        "decade": (year // 10) * 10,
        "budget": round(budget),
        "revenue": round(revenue),
        "roi": rounded(movie_roi),
        "profit": round(revenue - budget),
        "tier": budget_tier(budget),
        "outcome": roi_outcome(movie_roi),
        "genre": movie_genre,
        "genres": genres,
        "director": director if director != "nan" else "",
        "cast": top_cast,
        "tmdbRating": rounded(tmdb_rating, 2),
        "tmdbVotes": tmdb_votes,
        "rating": rounded(movielens_rating, 3),
        "ratingVotes": movielens_votes,
    }


def load_movies() -> tuple[list[dict[str, Any]], dict[str, int]]:
    csv.field_size_limit(2**31 - 1)
    selected: dict[int, dict[str, Any]] = {}
    counts = {
        "processedRows": 0,
        "validBudgetRevenueRows": 0,
        "excludedBelowBudgetFloor": 0,
        "duplicateEligibleRows": 0,
    }

    with PROCESSED_MOVIES.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            counts["processedRows"] += 1
            budget = number(row.get("budget"))
            revenue = number(row.get("revenue"))
            if budget is not None and budget > 0 and revenue is not None and revenue > 0:
                counts["validBudgetRevenueRows"] += 1
                if budget < BUDGET_FLOOR:
                    counts["excludedBelowBudgetFloor"] += 1
            movie = financial_row(row)
            if not movie:
                continue
            previous = selected.get(movie["id"])
            if previous is not None:
                counts["duplicateEligibleRows"] += 1
            if previous is None or movie["revenue"] > previous["revenue"]:
                selected[movie["id"]] = movie

    movies = sorted(selected.values(), key=lambda movie: (movie["year"], movie["title"]))
    return movies, counts


def load_collection_metadata() -> dict[int, dict[str, Any]]:
    collections: dict[int, dict[str, Any]] = {}
    with RAW_METADATA.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            movie_id = integer(row.get("id"))
            raw_collection = row.get("belongs_to_collection")
            raw_release_date = row.get("release_date")
            if movie_id is None or not raw_collection or not raw_release_date:
                continue
            try:
                collection = ast.literal_eval(raw_collection)
                released = date.fromisoformat(raw_release_date)
            except (SyntaxError, ValueError, TypeError):
                continue
            if not isinstance(collection, dict) or not collection.get("name"):
                continue
            collections[movie_id] = {
                "name": collection["name"],
                "releaseDate": released.isoformat(),
            }
    return collections


def enrich_collections(
    movies: list[dict[str, Any]], collection_metadata: dict[int, dict[str, Any]]
) -> None:
    for movie in movies:
        collection = collection_metadata.get(movie["id"])
        movie["collection"] = collection["name"] if collection else None


def load_poster_urls() -> dict[int, str]:
    if not POSTER_CACHE.exists():
        return {}
    with POSTER_CACHE.open(encoding="utf-8") as handle:
        cached = json.load(handle)
    return {int(movie_id): url for movie_id, url in cached.items() if url}


def enrich_posters(movies: list[dict[str, Any]], poster_urls: dict[int, str]) -> None:
    for movie in movies:
        movie["posterUrl"] = poster_urls.get(movie["id"])


def build_franchises(
    movies: list[dict[str, Any]], collection_metadata: dict[int, dict[str, Any]]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    movie_by_id = {movie["id"]: movie for movie in movies}
    full_collections: defaultdict[str, list[tuple[str, int]]] = defaultdict(list)
    for movie_id, collection in collection_metadata.items():
        full_collections[collection["name"]].append((collection["releaseDate"], movie_id))

    franchises: list[dict[str, Any]] = []
    comparisons: list[dict[str, Any]] = []
    for name, full_members in full_collections.items():
        ordered_members = sorted(full_members)
        if not ordered_members:
            continue
        original_id = ordered_members[0][1]
        original = movie_by_id.get(original_id)
        if not original:
            continue

        installments = []
        for order, (_, movie_id) in enumerate(ordered_members, start=1):
            movie = movie_by_id.get(movie_id)
            if not movie:
                continue
            comparison_value = movie["revenue"] / original["revenue"]
            installment = {
                "id": movie["id"],
                "order": order,
                "title": movie["title"],
                "year": movie["year"],
                "budget": movie["budget"],
                "revenue": movie["revenue"],
                "roi": movie["roi"],
                "rating": movie["rating"],
                "ratingVotes": movie["ratingVotes"],
                "genre": movie["genre"],
                "posterUrl": movie["posterUrl"],
                "revenueVsOriginal": rounded(comparison_value),
            }
            installments.append(installment)
            if movie_id != original_id:
                comparisons.append(
                    {
                        "collection": name,
                        "franchiseId": name,
                        "originalId": original["id"],
                        "sequelId": movie["id"],
                        "installment": order,
                        "originalTitle": original["title"],
                        "originalYear": original["year"],
                        "originalDecade": original["decade"],
                        "title": movie["title"],
                        "year": movie["year"],
                        "genre": original["genre"],
                        "originalRevenue": original["revenue"],
                        "sequelRevenue": movie["revenue"],
                        "originalRoi": original["roi"],
                        "sequelRoi": movie["roi"],
                        "originalRating": original["rating"],
                        "originalRatingVotes": original["ratingVotes"],
                        "sequelRating": movie["rating"],
                        "sequelRatingVotes": movie["ratingVotes"],
                        "posterUrl": movie["posterUrl"],
                        "budget": movie["budget"],
                        "revenueVsOriginal": rounded(comparison_value),
                    }
                )

        if len(installments) < 2:
            continue
        sequels = installments[1:]
        peak = max(installments, key=lambda film: film["revenue"])
        franchises.append(
            {
                "id": name,
                "name": name,
                "genre": original["genre"],
                "original": installments[0],
                "installments": installments,
                "eligibleSequels": len(sequels),
                "knownInstallments": len(ordered_members),
                "totalRevenue": sum(film["revenue"] for film in installments),
                "peakId": peak["id"],
                "improvedSequels": sum(
                    film["revenue"] > original["revenue"] for film in sequels
                ),
            }
        )

    valid_franchise_ids = {franchise["id"] for franchise in franchises}
    comparisons = [
        comparison for comparison in comparisons if comparison["franchiseId"] in valid_franchise_ids
    ]
    franchises.sort(key=lambda franchise: franchise["totalRevenue"], reverse=True)
    comparisons.sort(key=lambda comparison: (comparison["collection"], comparison["installment"]))
    return franchises, comparisons


def director_record(name: str, films: list[dict[str, Any]]) -> dict[str, Any]:
    ordered_films = sorted(films, key=lambda film: film["revenue"], reverse=True)
    rois = [film["roi"] for film in films]
    genre_counts = Counter(film["genre"] for film in films)
    return {
        "name": name,
        "filmCount": len(films),
        "medianRoi": rounded(median(rois)),
        "hitRate": rounded(sum(roi >= 2 for roi in rois) / len(rois)),
        "megahitRate": rounded(sum(roi > 10 for roi in rois) / len(rois)),
        "totalRevenue": sum(film["revenue"] for film in films),
        "medianRating": rounded(
            median(
                film["rating"]
                for film in films
                if film["rating"] is not None and film["ratingVotes"] >= RATING_MIN_VOTES
            )
        ),
        "genre": genre_counts.most_common(1)[0][0],
        "films": [
            {
                "id": film["id"],
                "title": film["title"],
                "year": film["year"],
                "revenue": film["revenue"],
                "roi": film["roi"],
                "genre": film["genre"],
                "posterUrl": film["posterUrl"],
            }
            for film in ordered_films
        ],
    }


def build_directors(movies: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for movie in movies:
        if movie["director"]:
            grouped[movie["director"]].append(movie)
    directors = [
        director_record(name, films)
        for name, films in grouped.items()
        if len(films) >= MIN_DIRECTOR_FILMS
    ]
    return sorted(directors, key=lambda director: director["totalRevenue"], reverse=True)


def correlation(pairs: list[tuple[float, float]]) -> float | None:
    if len(pairs) < 2:
        return None
    xs = [pair[0] for pair in pairs]
    ys = [pair[1] for pair in pairs]
    mean_x = statistics.mean(xs)
    mean_y = statistics.mean(ys)
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in pairs)
    denominator = math.sqrt(
        sum((x - mean_x) ** 2 for x in xs) * sum((y - mean_y) ** 2 for y in ys)
    )
    return numerator / denominator if denominator else None


def genre_summary(movies: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for movie in movies:
        grouped[movie["genre"]].append(movie)
    result = []
    for genre, films in grouped.items():
        result.append(
            {
                "genre": genre,
                "count": len(films),
                "medianRoi": rounded(median(film["roi"] for film in films)),
                "profitableShare": rounded(
                    sum(film["roi"] >= 1 for film in films) / len(films)
                ),
                "medianRevenue": rounded(median(film["revenue"] for film in films), 0),
            }
        )
    return sorted(result, key=lambda record: record["medianRoi"], reverse=True)


def build_summary(
    movies: list[dict[str, Any]],
    franchises: list[dict[str, Any]],
    comparisons: list[dict[str, Any]],
    directors: list[dict[str, Any]],
    counts: dict[str, int],
) -> dict[str, Any]:
    rated = [
        movie
        for movie in movies
        if movie["rating"] is not None and movie["ratingVotes"] >= RATING_MIN_VOTES
    ]
    sequel_improvements = sum(
        comparison["sequelRevenue"] > comparison["originalRevenue"]
        for comparison in comparisons
    )
    genre_stats = genre_summary(movies)
    repeated_directors = [director for director in directors if director["filmCount"] >= 6]
    return {
        "generatedFrom": "The Movies Dataset (Kaggle/TMDb) joined with MovieLens ratings",
        "analysisRules": {
            "minimumBudget": BUDGET_FLOOR,
            "requiresPositiveRevenue": True,
            "latestFinancialYear": 2017,
            "ratingMinimumVotes": RATING_MIN_VOTES,
            "genreAssignment": "First principal genre among the seven displayed genres; remaining films are grouped as Other.",
            "roiDefinition": "Gross box-office revenue divided by production budget.",
        },
        "counts": {
            **counts,
            "financialMovies": len(movies),
            "ratedFinancialMovies": len(rated),
            "franchises": len(franchises),
            "sequelComparisons": len(comparisons),
            "directorsWithSixFilms": len(repeated_directors),
        },
        "range": {
            "firstFinancialYear": min(movie["year"] for movie in movies),
            "lastFinancialYear": max(movie["year"] for movie in movies),
        },
        "headline": {
            "highestRevenue": max(movies, key=lambda movie: movie["revenue"]),
            "highestRoi": max(movies, key=lambda movie: movie["roi"]),
            "strongestGenre": genre_stats[0],
            "overallMedianRoi": rounded(median(movie["roi"] for movie in movies)),
            "sequelImprovementShare": rounded(
                sequel_improvements / len(comparisons) if comparisons else 0
            ),
            "sequelImprovements": sequel_improvements,
            "ratingRevenueCorrelation": rounded(
                correlation(
                    [(movie["rating"], math.log10(movie["revenue"])) for movie in rated]
                )
            ),
            "topGrossingDirector": max(
                repeated_directors, key=lambda director: director["totalRevenue"]
            ),
            "highestMedianRoiDirector": max(
                repeated_directors, key=lambda director: director["medianRoi"]
            ),
        },
        "genres": genre_stats,
    }


def write_json(filename: str, payload: Any) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUTPUT_DIR / filename
    with output.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=True, separators=(",", ":"))
    print(f"Wrote {output.relative_to(ROOT)} ({output.stat().st_size / 1024:.1f} KB)")


def build() -> None:
    movies, counts = load_movies()
    collection_metadata = load_collection_metadata()
    enrich_collections(movies, collection_metadata)
    enrich_posters(movies, load_poster_urls())
    franchises, comparisons = build_franchises(movies, collection_metadata)
    directors = build_directors(movies)
    summary = build_summary(movies, franchises, comparisons, directors, counts)

    write_json("movies.json", movies)
    write_json(
        "franchises.json",
        {"franchises": franchises, "comparisons": comparisons},
    )
    write_json("directors.json", directors)
    write_json("summary.json", summary)

    print(
        "Analysis subset: "
        f"{len(movies):,} films, {len(franchises):,} franchises, "
        f"{len(comparisons):,} sequel comparisons."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    build()
