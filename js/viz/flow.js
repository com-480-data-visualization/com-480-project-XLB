import {
  COLORS,
  GENRES,
  TIERS,
  TIER_LABELS,
  d3,
  filterMovies,
  formatInteger,
  formatMoney,
  formatPercent,
  formatRoi,
  median,
  setActiveButtons,
} from "../utils.js";

const ROI_OUTCOMES = [
  { key: "Flop", label: "FLOP < 0.5x", color: "#b54a3a" },
  { key: "Break-even", label: "BREAK-EVEN 0.5-2x", color: "#8d806b" },
  { key: "Hit", label: "HIT 2-10x", color: "#c9843a" },
  { key: "Megahit", label: "MEGAHIT > 10x", color: "#8b6410" },
];

const REVENUE_OUTCOMES = [
  { key: "Small", label: "UNDER $10M", color: "#b54a3a" },
  { key: "Solid", label: "$10-100M", color: "#8d806b" },
  { key: "Major", label: "$100-500M", color: "#c9843a" },
  { key: "Event", label: "OVER $500M", color: "#8b6410" },
];

function revenueOutcome(movie) {
  if (movie.revenue < 10e6) {
    return "Small";
  }
  if (movie.revenue < 100e6) {
    return "Solid";
  }
  if (movie.revenue < 500e6) {
    return "Major";
  }
  return "Event";
}

export function createFlow(movies, setGenre) {
  const container = document.getElementById("flow-viz");
  const count = document.getElementById("flow-count");
  const insight = document.getElementById("flow-insight");
  const reading = document.getElementById("flow-reading");
  let mode = "roi";
  let currentState = { genre: "All", decade: "all" };

  document.querySelectorAll("[data-flow-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.flowMode;
      setActiveButtons("[data-flow-mode]", mode, "flowMode");
      render(currentState);
    });
  });

  function updateInsight(genre, visible) {
    const films = genre ? visible.filter((movie) => movie.genre === genre) : visible;
    const label = genre || "All visible films";
    const hitShare = films.length
      ? films.filter((movie) => movie.roi >= 2).length / films.length
      : 0;
    const majorShare = films.length
      ? films.filter((movie) => movie.revenue >= 100e6).length / films.length
      : 0;
    const primaryValue = mode === "roi"
      ? formatRoi(median(films.map((movie) => movie.roi)))
      : formatMoney(median(films.map((movie) => movie.revenue)));
    const primaryLabel = mode === "roi" ? "MEDIAN ROI" : "MEDIAN BOX OFFICE";
    const outcomeValue = mode === "roi" ? formatPercent(hitShare) : formatPercent(majorShare);
    const outcomeLabel = mode === "roi" ? "HIT OR BETTER" : "$100M OR MORE";
    insight.innerHTML = `
      <p class="section-label">${genre ? "SELECTED ROUTE" : "READ THE FLOW"}</p>
      <h3>${label}</h3>
      <p>${genre ? "Click this genre to carry it into every chapter." : "Hover a genre to isolate its incoming budgets and outgoing results."}</p>
      <div class="insight-value">
        <strong>${primaryValue}</strong>
        <span>${primaryLabel} · ${formatInteger(films.length)} FILMS</span>
      </div>
      <div class="metric-grid">
        <div><strong>${outcomeValue}</strong><span>${outcomeLabel}</span></div>
        <div><strong>${formatInteger(films.filter((movie) => movie.tier === "Micro").length)}</strong><span>MICRO BUDGET</span></div>
      </div>
    `;
  }

  function render(state) {
    currentState = state;
    const visible = filterMovies(movies, state);
    count.textContent = `${formatInteger(visible.length)} films`;
    container.replaceChildren();
    updateInsight(state.genre === "All" ? null : state.genre, visible);
    const routes = d3
      .groups(visible, (movie) => movie.genre)
      .filter(([, films]) => films.length >= 5)
      .map(([genre, films]) => ({
        genre,
        films,
        roi: median(films.map((movie) => movie.roi)),
        hitShare: films.filter((movie) => movie.roi >= 2).length / films.length,
      }));
    const strongest = d3.greatest(routes, (route) => route.roi);
    const tierRoutes = TIERS.map((tier) => {
      const films = visible.filter((movie) => movie.tier === tier);
      return {
        tier,
        count: films.length,
        hitShare: films.length ? films.filter((movie) => movie.roi >= 2).length / films.length : null,
      };
    }).filter((route) => route.count);
    const strongestTier = d3.greatest(tierRoutes, (route) => route.hitShare);
    const weakestTier = d3.least(tierRoutes, (route) => route.hitShare);
    if (mode === "roi" && strongest && strongestTier && weakestTier) {
      reading.textContent = `When success means at least twice the recorded budget, ${TIER_LABELS[strongestTier.tier].toLowerCase()} sends ${formatPercent(strongestTier.hitShare)} of films to Hit or Megahit outcomes, compared with ${formatPercent(weakestTier.hitShare)} from ${TIER_LABELS[weakestTier.tier].toLowerCase()}. Genre prevents budget from being the full explanation: ${strongest.genre} records the strongest visible genre median at ${formatRoi(strongest.roi)}.`;
    } else if (mode === "revenue") {
      const grossRoutes = d3
        .groups(visible, (movie) => movie.genre)
        .filter(([, films]) => films.length >= 5)
        .map(([genre, films]) => ({
          genre,
          medianGross: median(films.map((movie) => movie.revenue)),
          majorShare: films.filter((movie) => movie.revenue >= 100e6).length / films.length,
        }));
      const grossLeader = d3.greatest(grossRoutes, (route) => route.medianGross);
      const reachLeader = d3.greatest(grossRoutes, (route) => route.majorShare);
      reading.textContent = grossLeader && reachLeader
        ? `On absolute box office, ${grossLeader.genre} has the highest visible genre median at ${formatMoney(grossLeader.medianGross)}, while ${reachLeader.genre} sends the largest share past $100M (${formatPercent(reachLeader.majorShare)}). This view rewards reach rather than efficiency, so it need not crown the same route as ROI.`
        : "No route is large enough for a stable comparison in this cut; widen the shared filters.";
    } else {
      reading.textContent = "No route is large enough for a stable comparison in this cut; widen the shared filters.";
    }

    const width = Math.max(container.clientWidth, 620);
    const height = 565;
    const margin = { top: 38, right: 158, bottom: 46, left: 142 };
    const outcomes = mode === "roi" ? ROI_OUTCOMES : REVENUE_OUTCOMES;
    const activeGenres = GENRES.filter((genre) => visible.some((movie) => movie.genre === genre));
    const nodes = [
      ...TIERS.map((tier) => ({ id: `tier:${tier}`, label: TIER_LABELS[tier], type: "tier" })),
      ...activeGenres.map((genre) => ({ id: `genre:${genre}`, label: genre.toUpperCase(), type: "genre", genre })),
      ...outcomes.map((outcome) => ({ id: `result:${outcome.key}`, label: outcome.label, type: "outcome", color: outcome.color })),
    ];
    const links = [];
    const addLink = (source, target, value) => {
      if (value) {
        links.push({ source, target, value });
      }
    };

    TIERS.forEach((tier) => {
      activeGenres.forEach((genre) => {
        addLink(
          `tier:${tier}`,
          `genre:${genre}`,
          visible.filter((movie) => movie.tier === tier && movie.genre === genre).length,
        );
      });
    });
    activeGenres.forEach((genre) => {
      outcomes.forEach((outcome) => {
        addLink(
          `genre:${genre}`,
          `result:${outcome.key}`,
          visible.filter((movie) => {
            const result = mode === "roi" ? movie.outcome : revenueOutcome(movie);
            return movie.genre === genre && result === outcome.key;
          }).length,
        );
      });
    });

    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("aria-label", "Budget tier, genre and outcome Sankey diagram");
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", margin.left)
      .attr("y", 21)
      .text("BUDGET TIER");
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", width / 2)
      .attr("y", 21)
      .attr("text-anchor", "middle")
      .text("GENRE");
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", width - margin.right + 14)
      .attr("y", 21)
      .text("OUTCOME");

    const sankey = d3
      .sankey()
      .nodeId((node) => node.id)
      .nodeWidth(9)
      .nodePadding(19)
      .nodeAlign(d3.sankeyJustify)
      .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);
    const graph = sankey({
      nodes: nodes.map((node) => ({ ...node })),
      links: links.map((link) => ({ ...link })),
    });
    const nodeColor = (node) => {
      if (node.type === "genre") {
        return COLORS[node.genre];
      }
      if (node.type === "outcome") {
        return node.color;
      }
      return "#b8a060";
    };

    const linkSelection = svg
      .append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(graph.links)
      .join("path")
      .attr("d", d3.sankeyLinkHorizontal())
      .attr("stroke", (link) => link.source.type === "genre" ? nodeColor(link.source) : nodeColor(link.target))
      .attr("stroke-opacity", 0.27)
      .attr("stroke-width", (link) => Math.max(1, link.width));

    const nodeSelection = svg
      .append("g")
      .selectAll("g")
      .data(graph.nodes)
      .join("g")
      .style("cursor", (node) => node.type === "genre" ? "pointer" : "default")
      .on("mouseenter", (_, node) => {
        linkSelection.attr("stroke-opacity", (link) => link.source === node || link.target === node ? 0.62 : 0.05);
        if (node.type === "genre") {
          updateInsight(node.genre, visible);
        }
      })
      .on("mouseleave", () => {
        linkSelection.attr("stroke-opacity", 0.27);
        updateInsight(state.genre === "All" ? null : state.genre, visible);
      })
      .on("click", (_, node) => {
        if (node.type === "genre") {
          setGenre(node.genre === state.genre ? "All" : node.genre);
        }
      });

    nodeSelection
      .append("rect")
      .attr("x", (node) => node.x0)
      .attr("y", (node) => node.y0)
      .attr("height", (node) => Math.max(2, node.y1 - node.y0))
      .attr("width", (node) => node.x1 - node.x0)
      .attr("fill", nodeColor);

    nodeSelection
      .append("text")
      .attr("class", "chart-label")
      .attr("x", (node) => node.type === "outcome" ? node.x1 + 10 : node.x0 - 10)
      .attr("y", (node) => (node.y0 + node.y1) / 2)
      .attr("dy", "-0.25em")
      .attr("text-anchor", (node) => node.type === "outcome" ? "start" : "end")
      .text((node) => node.label);
    nodeSelection
      .append("text")
      .attr("class", "chart-label")
      .attr("x", (node) => node.type === "outcome" ? node.x1 + 10 : node.x0 - 10)
      .attr("y", (node) => (node.y0 + node.y1) / 2)
      .attr("dy", "1.15em")
      .attr("text-anchor", (node) => node.type === "outcome" ? "start" : "end")
      .text((node) => `${formatInteger(Math.round(node.value))} FILMS`);
  }

  return { render };
}
