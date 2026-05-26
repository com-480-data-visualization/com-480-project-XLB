# CineScope — COM-480 Data Visualization

**EPFL 2026 · Team XLB**

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

### 2. Create and activate the analysis environment

The committed web exports are sufficient to view the website. This Python environment is only required to reproduce preprocessing and analysis exports.

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

### 4. Reproduce the processed web data

Open and run all cells in `eda/preprocessing.ipynb` to generate `data/processed/movies.csv`, then export the browser-ready data:

```bash
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
├── css/styles.css                # Cinematic visual system and responsive layouts
├── js/
│   ├── app.js                    # Story text, loading, navigation and shared controls
│   ├── data-loader.js            # Browser JSON loading
│   ├── state.js                  # Coordinated genre and decade filters
│   ├── utils.js                  # Formatting, sampling, tooltip and chart utilities
│   └── viz/                      # One D3 module for each delivered visualization
├── scripts/export_web_data.py    # Reproducible financial/franchise web export
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

CineScope is our interactive explorer structured around four coordinated views. The four proposed views were:

1. **The Dossier Board** — budget vs. revenue scatter with quadrant annotations and film hover cards
2. **The Flow** — Sankey diagram mapping budget tiers through genres to financial outcomes
3. **The Profitability Matrix** — genre × budget tier heatmap showing median ROI with a decade slider and drill-down view
4. **Dynasties** — original vs. sequel revenue scatter with franchise drill-down panel

Following the feedback highlighting the potential of *The Flow* and *Dynasties*, those views remain central to the final narrative and are driven by the real processed data in Milestone 3.

---

## Milestone 3

### Final Story

**What makes a movie successful?** CineScope follows six possible signals of success: scale, genre, return, inheritance, applause, and directing track record. The story moves from individual films to production strategies, then tests whether audience rating, franchise identity, or a recognised director can remove uncertainty.

> A movie can buy scale, earn applause, or inherit a name. None of them buys certainty.

### Data Preparation

CineScope is built from *The Movies Dataset* (Kaggle/TMDb), enriched with MovieLens audience ratings and collection information. We clean and join the source tables in the analysis pipeline, then generate compact visualization resources with `scripts/export_web_data.py` so the interactive story can be served statically on GitHub Pages.

| Analysis rule | Final decision |
| --- | --- |
| Financial eligibility | Positive recorded revenue and budget of at least `$10,000` |
| ROI definition | Gross box-office revenue divided by recorded production budget |
| Release coverage | Films through 2017, the endpoint of the source dataset |
| Rating evidence | MovieLens comparisons require at least 50 recorded ratings |
| Franchise evidence | Every eligible sequel is compared with its collection's eligible original |

The budget threshold removes unstable ROI values created by implausibly tiny recorded costs while retaining genuine low-budget breakouts such as *Paranormal Activity* (`$15,000` recorded budget). After thresholding and ID de-duplication, the financial universe contains **5,317 films**. The website computes aggregated results from all eligible films; only the Dossier Board limits individual plotted marks to a deterministic stratified sample of at most **800** so bubbles remain readable.

### Delivered Visualizations

1. **The Dossier Board** is a D3 log-scale scatter plot of budget against revenue or ROI. Genre and decade filters, title search, brush inspection, film tooltips, a break-even line, and named outcome regions let readers start with concrete movies.
2. **The Flow** is a D3-Sankey view from budget tier to genre to commercial outcome. Width encodes the number of eligible films; hovering traces a path and selecting a genre coordinates the wider story.
3. **The Profitability Matrix** is a genre-by-budget heatmap toggling median ROI and profitable share. Selecting a cell opens its ROI distribution against the complete current comparison group.
4. **Dynasties** compares **all** eligible sequels with their original on revenue, ROI, or rating. Selecting a collection opens its chronological franchise reel against the original-film baseline.
5. **Applause vs. Receipts** groups sufficiently rated films into audience-rating bands. Each band exposes its revenue or ROI range, middle 50%, median, and hoverable film evidence.
6. **The Name Above The Title** ranks repeat directors as portfolios by median ROI or total gross, with minimum-film thresholds and a selected-film detail panel.

### Narrative And Interaction

The persistent genre and decade controls update every relevant view. Scene-level metric switches let users distinguish total box office from gross return, while hover cards and drill-down panels preserve identifiable films behind aggregates.

The story tests a series of familiar promises: spend more, select the right genre, extend a successful franchise, win audience approval, or hire a recognised director. The Dossier Board exposes the wide spread of outcomes behind comparable budgets. The Flow and Profitability Matrix then show that genre and scale operate together, with Horror leading the displayed genres in median return. Dynasties tests inherited success more directly: across **573** eligible sequel-to-original comparisons in **309** collections, only **46.6%** of sequels outgross their original. Applause vs. Receipts adds a second definition of success: MovieLens rating and logged gross revenue show almost no association in this sample (`r = 0.017`). Together, the views support the concluding claim that cinema offers several paths to success, but no dependable formula.

### Technical Implementation And Intended Usage

- **Framework:** semantic HTML, modular vanilla JavaScript ES modules, CSS, and D3.js v7.
- **Specialized layouts:** `d3-sankey` for the flow diagram plus custom D3 heatmap, interval, reel, and ranked-marquee layouts.
- **Data delivery:** compact generated JSON files in `data/web/`, suitable for static GitHub Pages deployment.
- **Architecture:** shared application state for genre and decade; independent view modules under `js/viz/`.
- **Presentation mode:** the default `Dark Room` palette provides cinematic contrast, with an optional light-room toggle.
- **Use:** an exploratory editorial visualization for observed relationships, not a causal or revenue-prediction model.

### Process Book

The full design process, evolution from the Milestone 2 sketches, data decisions, technical challenges, and peer-assessment breakdown are documented in the [Milestone 3 process book](process_book_XLB.pdf).
