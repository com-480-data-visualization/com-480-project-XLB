# CineScope — COM-480 Data Visualization

**EPFL 2026 · Team XLB**

The website is live at [CineScope](https://com-480-data-visualization.github.io/com-480-project-XLB/).
                     
Watch the screencast on YouTube: [screencast](https://www.youtube.com/watch?v=Yn4Pk5wTq4g)

The process book [process book](process_book_XLB.pdf).

| Student's name | SCIPER |
| --- | --- |
| Hamza Barrada | 327986 |
| Amer Lakrami | 344911 |
| Ziad Chentouf | 344912 |
| Salma EL YADOUNI | 340859 |

[Milestone 1](#milestone-1) • [Milestone 2](#milestone-2) • [Milestone 3](#milestone-3)

---

## Getting Started

### 1. Clone the repository

```bash
git clone git@github.com:com-480-data-visualization/com-480-project-XLB.git
cd com-480-project-XLB
```

### 2. Create and activate the analysis environment

The committed web exports are sufficient to view the website. This Python environment is only required to reproduce preprocessing and analysis exports.

```bash
conda create -n movies-viz python=3.11 -y
conda activate movies-viz
pip install kaggle pandas matplotlib seaborn jupyter scipy pillow
```

### 3. Download the dataset

**Option 1 — Kaggle CLI (recommended)**

```bash
kaggle datasets download -d rounakbanik/the-movies-dataset -p data/raw/ --unzip
```

**Option 2 — Manual download**

1. Go to https://www.kaggle.com/datasets/rounakbanik/the-movies-dataset
2. Click Download (requires a free Kaggle account)
3. Unzip and move all CSV files into `data/raw/`

### 4. Reproduce the processed web data

Open and run all cells in `eda/preprocessing.ipynb` to generate `data/processed/movies.csv`, then export the browser-ready data:

```bash
python3 scripts/export_web_data.py
```

To refresh the optional contextual imagery used in selected detail panels:

```bash
python3 scripts/refresh_movie_posters.py --top-franchises 309 --top-grossing 200 --top-roi 200
python3 scripts/fetch_director_portraits.py
python3 scripts/export_web_data.py
```

### 5. Run the visualization

The website loads JSON files through `fetch`, so it must be served over HTTP:

```bash
python3 -m http.server 8080
```

Open <http://localhost:8080/>.

---

## Repository Map

```text
.
├── index.html                    # Narrative page structure and view containers
├── assets/images/cover.webp      # Optimized cinematic hero artwork
├── assets/images/directors/      # Attributed Commons portrait thumbnails
├── css/styles.css                # Parchment/light default, dark-room option and responsive layouts
├── js/
│   ├── app.js                    # Story text, loading, navigation and shared controls
│   ├── data-loader.js            # Browser JSON loading
│   ├── state.js                  # Coordinated genre and decade filters
│   ├── utils.js                  # Formatting, sampling, tooltip and chart utilities
│   └── viz/                      # One D3 module for each delivered visualization
├── scripts/export_web_data.py    # Reproducible financial/franchise web export
├── scripts/refresh_movie_posters.py  # Refreshes current TMDb poster URL cache
├── scripts/fetch_director_portraits.py  # Reproducible Commons portrait export
├── data/
│   ├── README.md                 # Data contract and documented analysis rules
│   ├── raw/                      # Kaggle downloads, not committed
│   ├── processed/                # Notebook output, not committed
│   └── web/                      # Compact JSON files loaded by the final website
├── eda/                          # Preprocessing notebook, EDA notebook and figures
├── sketches/                     # Milestone 2 visual design proposals
├── MS2_XLB.pdf                   # Milestone 2 report
└── process_book_XLB.pdf          # Milestone 3 process book
```

---

## Milestone 1

### Dataset

The dataset we chose is [The Movies Dataset](https://www.kaggle.com/datasets/rounakbanik/the-movies-dataset), publicly available on Kaggle (originally sourced from The Movie Database, TMDb). It consists of several interconnected CSV files covering approximately 45,000 movies released between 1874 and 2017.

The core files are:

- `movies_metadata.csv` — titles, genres, budget, revenue, release dates, runtime, vote average and vote count
- `credits.csv` — full cast and crew information (actors, directors, writers) stored as nested JSON strings
- `keywords.csv` — thematic tags associated with each movie
- `ratings.csv` — over 26 million ratings from 270,000 users on a 0.5–5 scale
- `links.csv` — IMDb and TMDb IDs used to join tables

**Data quality assessment.** The dataset is generally well-structured but requires moderate preprocessing. The most significant issues are:

- `budget` and `revenue` columns contain many zero values representing missing data rather than actual zeros — only ~12–19% of films have valid financial figures
- `credits` and `genres` columns store data as nested JSON strings that need to be parsed with Python's `ast` module
- A small number of duplicate entries exist and must be removed
- Some release dates are malformed or missing, requiring error-tolerant date parsing

Despite these issues, the dataset is rich enough to support a wide range of visualizations with manageable preprocessing effort. From `credits.csv` we extracted director names and top 3 billed cast members per movie. From `ratings.csv` (26 million ratings) we computed per-movie average ratings, vote counts, and rating dispersion. All preprocessing produces a clean file saved to `data/processed/movies.csv` (one row per movie, 25 columns).

---

### Problematic

Cinema is one of the most universal forms of cultural expression, generating over $100 billion in global revenue annually and reaching audiences worldwide. Behind every film lies a complex set of decisions — genre, budget, release timing — that influence whether it becomes a commercial success or fades into obscurity.

Our visualization explores the question: **What factors drive financial and critical success in movies, and how have these relationships evolved over time?** We analyze the interplay between production characteristics (budget, genre) and outcomes (box office revenue, audience ratings), while tracking how these patterns shifted across decades.

We are particularly interested in questions such as:

- Do higher budgets reliably translate into higher revenue?
- How strongly are audience ratings correlated with financial success?
- Which genres have risen or declined in popularity and profitability over time?

The target audience is broad: film enthusiasts, students, and general audiences curious about the dynamics of the movie industry. The project emphasizes interactive exploration, allowing users to test their own hypotheses and uncover patterns rather than passively consuming static visualizations.

---

### Exploratory Data Analysis

Preprocessing produced a clean dataset of 45,697 films. The financial subset (films with both valid budget and revenue) covers 5,417 films. All figures are saved in `eda/figures/`.

**Distributions:** Budget and revenue are heavily right-skewed, spanning five orders of magnitude ($100K to over $1B), and require log-transformation for meaningful visualization. Most films run 90–120 minutes. TMDb ratings cluster between 6 and 7 out of 10 with a mean of ~6.5, while MovieLens ratings are tighter with a mean of ~3.2 out of 5, confirming that the two systems are correlated (r ≈ 0.55) but measure different things.

**Missing data:** Budget and revenue are missing for over 80% of films — the key limitation for financial analysis. Director is missing for ~2% of films. MovieLens ratings are available for ~60% of the dataset, though vote counts are highly skewed toward a small number of popular films.

**Financial patterns:** Budget and revenue correlate strongly in log space (r ≈ 0.7), but the relationship is noisy — many high-budget films underperform while some low-budget films achieve extreme ROI. The median ROI has declined since the 1980s as production budgets have grown faster than box office returns. Horror delivers the highest median ROI among displayed genres; Animation delivers the highest absolute median revenue. Notably, audience rating and logged box-office gross show almost no linear association (r ≈ 0.017), meaning commercial and critical success are largely independent dimensions.

**Genre and time:** Drama and Comedy are the most common genres across all decades. Action's share of production roughly tripled from the 1970s to the 2000s, while the Western genre nearly vanished after the 1970s.

---

### Related Work

The Movies Dataset has been widely used on Kaggle, primarily for revenue prediction and recommendation systems. Most existing work focuses on a single axis (predicting box office from budget, or rating-based recommendation) and visualizations are typically static exploratory notebooks without a designed narrative.

Our approach differs in two key ways. First, we treat financial and critical success as two parallel dimensions and examine where they align or diverge. Second, we build an interactive visualization that lets users explore these relationships themselves, rather than presenting fixed conclusions.

For inspiration we draw on the Pudding's essay-style scrollytelling pieces, the NYT Graphics unit's interactive charts, and FlowingData's use of small multiples embedded in narrative prose.

---

## Milestone 2

See [MS2_XLB.pdf](MS2_XLB.pdf) for the full project description, visualization sketches, tools and work breakdown.

CineScope is our interactive explorer structured around four coordinated views. The four proposed views were:

1. **The Dossier Board** — budget vs. revenue scatter with quadrant annotations and film hover cards
2. **The Flow** — Sankey diagram mapping budget tiers through genres to financial outcomes
3. **The Profitability Matrix** — genre × budget tier heatmap showing median ROI with a decade slider and drill-down view
4. **Dynasties** — original vs. sequel revenue scatter with franchise drill-down panel

Following the feedback highlighting the potential of *The Flow* and *Dynasties*, those views remain central to the final narrative and are driven by the real processed data in Milestone 3.

---

## Milestone 3

*A movie can buy scale, earn applause, or inherit a name. None of them buys certainty.*

### Live Website

**[cinescope](https://com-480-data-visualization.github.io/com-480-project-XLB/)**

### Screencast

Watch the screencast on YouTube: [screencast](https://www.youtube.com/watch?v=Yn4Pk5wTq4g)

### Process Book

The full design journey from Milestone 2 sketches to final visual forms, data decisions, challenges, and peer-assessment is in [process book](process_book_XLB.pdf).

### Six Views

| # | View | What it answers |
|---|------|----------------|
| 1 | **Dossier Board** | Log-scale bubble plot of budget vs. revenue/ROI |
| 2 | **The Flow** | Sankey from budget tier → genre → commercial outcome |
| 3 | **Profitability Matrix** | Genre × budget heatmap with median ROI and drill-down distributions |
| 4 | **Dynasties** | Every eligible sequel vs. its franchise original across revenue, ROI and rating |
| 5 | **Applause vs. Receipts** | Does audience approval predict box-office returns? |
| 6 | **The Name Above the Title** | Repeat-director portfolios ranked by efficiency or scale |

### Key Findings

- **Small bets multiply harder**  Micro-budget films return 2.98× median ROI vs. 2.24× for blockbusters
- **Franchise expansion loses efficiency** 46.6% of sequels outgross their original; only 18.0% improve ROI
- **Applause and receipts diverge** Rating vs. logged gross: *r* = 0.017

---

### Late Policy

- < 24h late: 80% of the grade for the milestone
- < 48h late: 70% of the grade for the milestone
