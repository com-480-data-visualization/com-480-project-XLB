# CineScope — COM-480 Data Visualization

The website is live at [CineScope](https://com-480-data-visualization.github.io/com-480-project-XLB/).

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

### 2. Create and activate the conda environment

```bash
conda create -n movies-viz python=3.11 -y
conda activate movies-viz
pip install kaggle pandas matplotlib seaborn jupyter scipy
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

### 4. Run the preprocessing notebook

Open and run all cells in `eda/preprocessing.ipynb`. This generates `data/processed/movies.csv`.

### 5. Open the visualization

Simply open `index.html` in any modern browser. The visualization runs entirely client-side — no server required.

```bash
# Quick local server (optional, for Chrome which blocks some file:// requests)
python -m http.server 8080
# then open http://localhost:8080
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

The target audience is broad: film enthusiasts, students, and general audiences curious about the dynamics of the movie industry. The project emphasizes interactive exploration, allowing users to test their own hypotheses and uncover patterns rather than passively consuming static visualizations.

---

### Exploratory Data Analysis

Preprocessing produced a clean dataset of 45,697 films. The financial subset (films with both valid budget and revenue) covers 5,417 films.

**Distributions:** Budget and revenue are heavily right-skewed, spanning five orders of magnitude ($100K to over $1B), and require log-transformation for meaningful visualization. Most films run 90–120 minutes. TMDb ratings cluster between 6 and 7 out of 10 with a mean of ~6.5, while MovieLens ratings are tighter with a mean of ~3.2 out of 5, confirming that the two systems are correlated (r ≈ 0.55) but measure different things.

**Financial patterns:** Budget and revenue correlate strongly in log space (r ≈ 0.7), but the relationship is noisy — many high-budget films underperform while some low-budget films achieve extreme ROI. The median ROI has declined since the 1980s as production budgets have grown faster than box office returns. By genre, Horror delivers the highest median ROI and Animation delivers the highest absolute median revenue.

**Genre and time:** Drama and Comedy are the most common genres across all decades. Action's share of production roughly tripled from the 1970s to the 2000s, while the Western genre nearly vanished after the 1970s.

---

### Related work

The Movies Dataset has been widely used on Kaggle, primarily for revenue prediction and recommendation systems. Most existing work focuses on a single axis (predicting box office from budget, or collaborative filtering on ratings data) and visualizations are typically static exploratory notebooks without a designed narrative.

Our approach differs in two key ways. First, we treat financial and critical success as two parallel dimensions and examine where they align or diverge. Second, we build an interactive visualization that lets users explore these relationships themselves, rather than presenting fixed conclusions.

For inspiration we draw on the Pudding's essay-style scrollytelling pieces, the NYT Graphics unit's interactive charts, and FlowingData's use of small multiples embedded in narrative prose.

---

## Milestone 2

See [MS2_XLB.pdf](MS2_XLB.pdf) for the full project description, visualization sketches, tools and work breakdown.

CineScope is our interactive explorer structured around four coordinated views. The four views are:

1. **The Dossier Board** — budget vs. revenue scatter with quadrant annotations and film hover cards
2. **The Flow** — Sankey diagram mapping budget tiers through genres to financial outcomes
3. **The Profitability Matrix** — genre × budget tier heatmap showing median ROI with a decade slider and drill-down view
4. **Dynasties** — original vs. sequel revenue scatter with franchise drill-down panel

---

## Milestone 3

### What was built

All four visualizations are fully implemented and interactive:

**01 — The Dossier Board**
- D3.js log-log scatter plot of production budget vs. box office revenue
- Genre filter pills and Y-axis toggle (Revenue / ROI)
- Break-even diagonal with quadrant annotations (Blockbusters, Micro-Budget Breakouts, Flops, Big-Budget Misses)
- Rich hover tooltip showing title, year, budget, revenue, ROI, rating and director
- Responsive to window resize

**02 — The Flow**
- D3-Sankey diagram tracing films from budget tier → genre → financial outcome
- Three-layer Sankey with node and link hover highlighting
- Filter toggle: All Films / Hits Only (>3× ROI) / Flops Only (<1× ROI)
- Node labels with film counts; link widths encode volume

**03 — The Profitability Matrix**
- Genre × budget tier heatmap encoding median ROI per cell
- Decade filter (1970s–2010s) and metric toggle (Median ROI / % Profitable)
- Click any cell to reveal a ranked bar chart of films in that segment
- Sequential color scale from dark (low) to gold (high)

**04 — Dynasties**
- Bubble scatter: X = original film revenue (log), Y = peak sequel revenue / original (multiplier)
- Bubble size encodes total franchise gross; color encodes genre
- Reference line at multiplier = 1 (sequel equals original)
- Click any franchise bubble to reveal its full revenue arc with ranked bar chart
- Covers 15 major franchises from 1964–2021

### Technical implementation

- **Framework**: Vanilla JavaScript + D3.js v7 + d3-sankey v0.12
- **No build step**: single `index.html`, works directly from GitHub Pages
- **Data**: curated embedded dataset of 140+ films covering all genres and decades 1968–2021; structured to accept a larger JSON dataset from the preprocessing pipeline
- **Responsive**: all four scenes redraw on window resize
- **Libraries**: D3.js (cdnjs), d3-sankey (jsdelivr), Google Fonts (Playfair Display, DM Mono, DM Sans)

### Process book

See [process_book_XLB.pdf](process_book_XLB.pdf) for the full process book covering design rationale, development process, data decisions, and team contributions.

### Screencast

See [screencast_XLB.mp4](screencast_XLB.mp4) for the 2-minute demonstration video.

---

### Late policy

- < 24h late: 80% of the grade for the milestone
- < 48h late: 70% of the grade for the milestone
