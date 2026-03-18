# Data

Raw CSV files are NOT committed to this repository (file size).

## Source
Kaggle: https://www.kaggle.com/datasets/rounakbanik/the-movies-dataset

## Download Instructions
1. Go to the Kaggle link above (free account required)
2. Click Download
3. Unzip everything into `data/raw/`

## Files We Use

| File | Size | Purpose |
|------|------|---------|
| movies_metadata.csv | ~34MB | Main file: budget, revenue, genres, release dates |
| credits.csv | ~40MB | Cast and crew JSON for director/actor analysis |
| ratings.csv | ~710MB | Full 26M ratings |
| keywords.csv | ~5MB | Plot keywords (optional enrichment) |
| links_small.csv | <1MB | Bridge between movieId and tmdbId |
