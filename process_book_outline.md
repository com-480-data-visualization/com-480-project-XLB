# CineScope — Process Book
## COM-480 Data Visualization · EPFL 2026 · Team XLB

**Team:** Hamza Barrada · Amer Lakrami · Ziad Chentouf · Salma El Yadouni  
**Dataset:** The Movies Dataset (Kaggle / TMDb) — 45,697 films, 1874–2017

---

## 1. Introduction & Motivation

Cinema is one of the most data-rich cultural industries. Every year, thousands of films compete for audiences and revenue, yet the factors separating a $10 M indie hit from a $250 M blockbuster disappointment remain poorly understood by the general public.

Our question: **What drives financial and critical success in movies, and how have these relationships evolved over 50 years?**

We focus on the intersection of production decisions (budget, genre) and outcomes (box office revenue, audience ratings), using the publicly available TMDb/MovieLens dataset. The visualization targets a broad audience — cinephiles, students, and industry-curious users — and emphasizes exploration over passive presentation.

---

## 2. Related Work

| Work | What we borrowed | What we did differently |
|---|---|---|
| Pudding essay-style stories | Narrative prose framing each scene | Full interactivity, not scroll-locked |
| NYT Graphics unit charts | Log-log scatter for financial data | Added quadrant annotations and genre filters |
| Kaggle revenue prediction notebooks | Data pipeline structure | Focused on visualization, not prediction |
| FlowingData small multiples | Matrix layout for genre × budget | Added decade filter and drill-down |

Our contribution is treating financial and critical success as **two parallel, comparable dimensions** rather than optimizing for one.

---

## 3. Dataset & Preprocessing

### Source
- `movies_metadata.csv` — 45,697 films, genres, budget, revenue, dates
- `credits.csv` — cast/crew parsed from nested JSON strings
- `ratings.csv` — 26 M MovieLens ratings from 270,000 users
- `keywords.csv` — thematic tags per film

### Key preprocessing decisions

**Budget/revenue zeros:** Approximately 80% of entries have zero budget or revenue, representing missing data (not true zeros). We filter these out for all financial analysis, yielding a **financial subset of 5,417 films**.

**Genre assignment:** Films have multiple genres. We assign a primary genre based on the first entry in the genre list after excluding Documentary, Music, and TV Movie (low financial data quality).

**ROI definition:** We define ROI as `revenue / budget` (gross multiplier), not net profit. This allows direct comparison across budget tiers without needing P&A data.

**Rating normalization:** TMDb vote averages (0–10 scale) and MovieLens ratings (0.5–5 scale) are both present. We use MovieLens for analysis (higher coverage for our financial subset) and TMDb for display.

**Budget tier boundaries:** Micro (<$5M), Low ($5–20M), Mid ($20–60M), Blockbuster (>$60M). These roughly correspond to indie, mid-range, studio, and tentpole production levels.

---

## 4. Exploratory Data Analysis

Key findings that shaped design decisions:

- **Budget vs. revenue** correlates strongly on log scale (r ≈ 0.7) but with enormous variance — the scatter is essential, not a summary statistic.
- **Horror** has the highest median ROI (~8× at micro-budget tier) because successful films routinely earn 50–4000× their cost on tiny budgets.
- **Animation** has the highest median absolute revenue at blockbuster tier — audiences reliably show up for family-friendly animations.
- **The 1990s–2000s** saw a dramatic shift: Action's share of production tripled, and average budgets inflated faster than box office.
- **Ratings vs. revenue** are positively correlated (r ≈ 0.35) — critical quality and commercial success are allies, not opposites.

These patterns directly motivated the four scenes: the Dossier Board (budget → revenue), The Flow (which paths lead to success), The Matrix (genre × budget profitability), and Dynasties (sequel dynamics).

---

## 5. Design Process

### 5.1 Visual idioms considered

| Scene | Alternatives considered | Final choice | Reason |
|---|---|---|---|
| Budget vs. revenue | Hexbin, contour, scatter | Log-log scatter | Preserves individual film identity; hover tooltip enables exploration |
| Budget → outcome paths | Alluvial, chord diagram, treemap | Sankey | Correctly encodes directed flow with magnitude |
| Genre × budget performance | Bar charts, small multiples | Heatmap | Enables simultaneous comparison across 28 cells |
| Sequel performance | Slope chart, bar race | Bubble scatter + detail panel | Separates "original quality" signal from "sequel effect" |

### 5.2 Color palette

We use a **warm parchment / cinematic gold** palette (`#f2ebe0` background, `#d4a830` gold accent) to evoke the aesthetic of a film archive or classic movie poster. Genre colors are distinct, perceptually separable hues assigned consistently across all scenes:

| Genre | Color |
|---|---|
| Action | `#c9843a` (burnt orange) |
| Drama | `#7a6fbd` (muted violet) |
| Comedy | `#4a9e78` (sage green) |
| Horror | `#b54a3a` (deep red) |
| Animation | `#c9558a` (rose) |
| Thriller | `#4a8ab5` (slate blue) |
| Sci-Fi | `#4aab9e` (teal) |

### 5.3 Typography

- **Playfair Display** (serif) — headlines and film titles; conveys editorial prestige
- **DM Mono** (monospaced) — data labels, axes, navigation; emphasizes precision
- **DM Sans** (sans-serif) — body text; readability for narrative prose

### 5.4 From sketch to implementation

**MS2 sketches → MS3 implementation changes:**

- *Dossier Board*: Sketch showed a static scatter. Final version adds genre filter pills, Y-axis toggle (revenue / ROI), quadrant annotations, and a rich hover tooltip.
- *The Flow*: Sketch was a static SVG placeholder. Final version is a fully interactive D3-Sankey with node/link hover highlighting and a filter toggle (All / Hits / Flops).
- *Profitability Matrix*: Sketch showed a 6×4 static heatmap. Final version adds decade filtering, metric toggle (Median ROI / % Profitable), and a click-to-detail bar chart for each cell.
- *Dynasties*: Sketch showed a simple scatter with diagonal line. Final version uses log-scaled X, adds bubble sizing by total franchise gross, hover tooltips, and a click-to-expand detail panel showing the full revenue arc.

---

## 6. Implementation

### Technical stack

- **D3.js v7** (cdnjs) — all chart rendering
- **d3-sankey v0.12** (jsdelivr) — Sankey layout for Scene 02
- **Google Fonts** — Playfair Display, DM Mono, DM Sans
- **Vanilla JS** — no framework; state management via module-level variables
- **GitHub Pages** — static hosting, zero build step

### Key implementation decisions

**Single-file architecture**: The entire visualization lives in `index.html`. This makes deployment trivial (GitHub Pages, no build step) and avoids CORS issues with local file loading.

**Embedded curated dataset**: Rather than loading the full 5,417-film CSV at page load (which would be slow and require a server), we embed a curated representative dataset of 140+ hand-selected films directly in the HTML. The film selection covers all genres, all decades (1968–2021), and includes both notable successes and famous failures to ensure all four scenes have meaningful data.

**Sankey string IDs**: A key implementation decision was to use string node IDs (`'tier_micro'`, `'genre_Horror'`, `'out_hit'`) rather than integer indices in the D3-Sankey layout. This avoids a common bug where `nodeId(d => d.index)` is called before d3-sankey has assigned `.index` to nodes.

**Responsive redraws**: All four scenes register a single `window.resize` listener that rerenders everything. SVG dimensions are computed from the container's `clientWidth` on each render, so the layout adapts cleanly to any viewport.

---

## 7. Results & Insights

The four scenes together tell a coherent story:

1. **Budget alone does not predict revenue.** The Dossier Board shows enormous variance around the break-even line — horror micro-budgets often outperform $200M action films on ROI.

2. **Most mid-budget films break even; only a few genres reliably hit.** The Flow reveals that the blockbuster tier has a higher share of hits, but the micro-budget horror path has an even higher *percentage* of hits relative to its size.

3. **Horror is the most financially efficient genre.** The Matrix consistently shows Horror at the top of the micro-budget column, regardless of decade — a structurally robust finding.

4. **Sequels usually outperform originals — but not always.** Dynasties shows that most major franchises above the golden line, with Fast & Furious (7.3×), James Bond (8.9×), and Marvel (4.8×) as standout growth stories. Rocky/Creed is a notable exception — its sequels never matched the original's cultural impact.

---

## 8. Team Contributions

| Member | Primary contributions |
|---|---|
| Hamza Barrada | Data preprocessing pipeline, EDA notebook, Dossier Board scene |
| Amer Lakrami | The Flow (Sankey) implementation, cross-scene state management |
| Ziad Chentouf | Profitability Matrix implementation, CSS design system |
| Salma El Yadouni | Dynasties scene, franchise dataset, process book, screencast |

All team members contributed to design decisions, data selection, and code review.

---

## 9. Challenges & Limitations

**Data coverage:** Only ~12% of TMDb films have both valid budget and revenue. All financial analysis is therefore biased toward films with significant theatrical releases (primarily US/UK studio productions). Arthouse, foreign-language, and direct-to-video films are systematically underrepresented.

**ROI simplification:** Our ROI metric uses theatrical gross only. P&A (prints and advertising) costs, home video revenue, and streaming rights are not captured. A $10M gross on a $60M film still appears as a 0.17× flop even if streaming rights recovered the cost.

**Genre assignment:** TMDb assigns multiple genres per film. Our primary-genre simplification loses information — a horror-comedy is counted as either Horror or Comedy depending on tag ordering.

**Franchise data:** The Dynasties dataset is manually curated from well-known Hollywood franchises, biased toward English-language blockbusters. Revenue figures do not adjust for inflation or P&A costs.

**Temporal bias:** The dataset covers 1874–2017. Films from 1874–1960 are heavily underrepresented and financial data quality is poor. Most visual patterns reflect the 1970–2017 era.

---

## 10. Conclusion

CineScope demonstrates that production budget is a necessary but not sufficient predictor of commercial success. Genre choice interacts strongly with budget — Horror creates exceptional value at micro-budget scale, while Animation rewards scale. The Dynasties analysis reveals that sequels typically outperform originals when the original itself was a breakout success, but established audience trust (not just brand name) is what drives franchise growth.

The visual design — cinematic palette, serif headlines, monospace data labels — reinforces the subject matter while remaining analytically precise. The interactive structure allows users to explore their own hypotheses, moving from the global overview (Dossier Board) to the structural map (Flow and Matrix) to individual franchise stories (Dynasties).
