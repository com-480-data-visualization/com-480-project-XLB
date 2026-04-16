# Project of Data Visualization (COM-480)

| Student's name | SCIPER |
| --- | --- |
| Hamza Barrada | 327986 |
| Amer Lakrami | 344911 |
| Ziad Chentouf | 344912 |
| Salma EL YADOUNI | 340859 |

[Milestone 1](#milestone-1-20th-march-5pm) • [Milestone 2](#milestone-2-17th-april-5pm) • [Milestone 3](#milestone-3-29th-may-5pm)

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

See `data/README.md` for details on each file.

### 4. Run the preprocessing notebook

Open and run all cells in `eda/preprocessing.ipynb`. This generates `data/processed/movies.csv`.

### 5. Run the EDA notebook

Open and run all cells in `eda/eda.ipynb`. This generates all figures in `eda/figures/`.

---

## Milestone 1 (20th March, 5pm)

### Dataset

The dataset we chose is [The Movies Dataset](https://www.kaggle.com/datasets/rounakbanik/the-movies-dataset), publicly available on Kaggle (originally sourced from The Movie Database, TMDb). It consists of several interconnected CSV files covering approximately 45,000 movies released between 1874 and 2017.

The core files are:

- `movies_metadata.csv` : titles, genres, budget, revenue, release dates, runtime, vote average and vote count
- `credits.csv` : full cast and crew information (actors, directors, writers) stored as nested JSON strings
- `keywords.csv` : thematic tags associated with each movie
- `ratings.csv` : over 26 million ratings from 270,000 users on a 0.5–5 scale
- `links.csv` : IMDb and TMDb IDs used to join tables


**Data quality assessment.** The dataset is generally well-structured but requires moderate preprocessing. The most significant issues are:

- The `budget` and `revenue` columns contain many zero values representing missing data rather than actual zeros, which must be filtered before any financial analysis, only ~12–19% of films have valid financial figures
- The `credits` and `genres` columns store data as nested JSON strings that need to be parsed with Python's `ast` module
- A small number of duplicate entries exist and must be removed
- Some release dates are malformed or missing, requiring error-tolerant date parsing


Despite these issues, the dataset is rich enough to support a wide range of visualizations with manageable preprocessing effort. We work with all five files. From `credits.csv` we extracted director names and top 3 billed cast members per movie. From `ratings.csv` (26 million ratings) we computed per-movie average ratings, vote counts, and rating dispersion. All preprocessing produces a clean file saved to `data/processed/movies.csv` (one row per movie, 25 columns).

---

### Problematic

Cinema is one of the most universal forms of cultural expression, generating over $100 billion in global revenue annually and reaching audiences worldwide. Behind every film lies a complex set of decisions such as genre, budget, and release timing that influence whether it becomes a commercial success or fades into obscurity.

Our visualization explores the question: **What factors drive financial and critical success in movies, and how have these relationships evolved over time?** We analyze the interplay between production characteristics (such as budget and genre) and outcomes (box office revenue and audience ratings), while tracking how these patterns have shifted across decades.

We are particularly interested in questions such as:

- Do higher budgets reliably translate into higher revenue?
- How strongly are audience ratings correlated with financial success?
- Which genres have risen or declined in popularity and profitability over time?

The target audience is broad, including film enthusiasts, students, and general audiences curious about the dynamics of the movie industry. The project emphasizes interactive exploration, allowing users to test their own hypotheses and uncover patterns rather than passively consuming static visualizations.

This project is motivated by the combination of cultural relevance and data richness: movies are widely relatable, while the dataset provides enough depth to reveal non-obvious insights. Our goal is to transform raw data into a clear and engaging narrative about the evolving relationship between creativity and commercial success in filmmaking.

---

### Exploratory Data Analysis

Preprocessing produced a clean dataset of 45,697 films. The financial subset ( films with both valid budget and revenue ) covers 5,417 films. All figures are saved in `eda/figures/`.

**Distributions:** 
Budget and revenue are heavily right-skewed, spanning five orders of magnitude ($100K to over $1B), and require log-transformation for meaningful visualization. Most films run 90–120 minutes. TMDb ratings cluster between 6 and 7 out of 10 with a mean of ~6.5, while MovieLens ratings are tighter and harsher with a mean of ~3.2 out of 5 ,confirming that the two systems are correlated (r ≈ 0.55) but measure different things.

**Missing data:** 
Budget and revenue are missing for over 80% of films, which is the key limitation for financial analysis. The director is missing for roughly 2% of films. MovieLens ratings are available for around 60% of the dataset, though vote counts are highly skewed toward a small number of popular films.

**Financial patterns:**
 Budget and revenue correlate strongly in log space (r ≈ 0.7), but the relationship is noisy, many high-budget films underperform while some low-budget films achieve extreme ROI. The median ROI has declined since the 1980s as production budgets have grown faster than box office returns. By genre, Horror delivers the highest median ROI and Animation delivers the highest absolute median revenue. Higher-rated films earn more at the box office and return better ROI, suggesting critical and commercial success are correlated rather than at odds.

**Genre and time:** 
Drama and Comedy are the most common genres across all decades. Action's share of production roughly tripled from the 1970s to the 2000s, while the Western genre nearly vanished after the 1970s. Documentary and Animation are the highest-rated genres by MovieLens audiences; Horror is the lowest-rated genre but the most financially efficient per dollar of budget.

---

### Related work

The Movies Dataset has been widely used on Kaggle, primarily for revenue prediction and recommendation systems. Most existing work focuses on a single axis, predicting box office from budget, or collaborative filtering on the ratings data and visualizations are typically static exploratory notebooks without a designed narrative.

Our approach differs in two key ways. First, we treat financial and critical success as two parallel dimensions and examine where they align or diverge, rather than optimizing for one outcome. Second, we intend to build an interactive visualization that lets users explore these relationships themselves, rather than presenting fixed conclusions.

For inspiration we draw on the Pudding's essay-style scrollytelling pieces, the NYT Graphics unit's interactive charts, and FlowingData's use of small multiples embedded in narrative prose. These set the bar for combining analytical rigour with accessible, well-designed storytelling, which is the standard we aim for.

---

## Milestone 2 (17th April, 5pm)

See [MS2_XLB.pdf](MS2_XLB.pdf) for the full project description, visualization sketches, tools and work breakdown.

The website prototype is live at [CineScope](https://com-480-data-visualization.github.io/com-480-project-XLB).

**CineScope** is our interactive explorer structured around four coordinated views. Selecting a genre or decade in any view filters the others, allowing users to pursue one hypothesis across multiple perspectives simultaneously.

The four views are the Bubble Galaxy (budget vs revenue scatter with genre clustering and quadrant annotations), The Flow (Sankey diagram mapping budget tiers through genres to financial outcomes), The Profitability Matrix (genre × budget heatmap showing median ROI with a decade slider), and Sequels Under the Spotlight (original vs sequel revenue scatter with radial franchise drill-down).

---

## Milestone 3 (29th May, 5pm)

*To be completed.*

---

### Late policy

- < 24h late: 80% of the grade for the milestone
- < 48h late: 70% of the grade for the milestone
