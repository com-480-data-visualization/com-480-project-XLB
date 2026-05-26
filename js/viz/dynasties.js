import {
  COLORS,
  d3,
  formatInteger,
  formatMoney,
  formatPercent,
  formatRoi,
  hideTooltip,
  limitText,
  moveTooltip,
  setActiveButtons,
  showTooltip,
} from "../utils.js";

function matchesComparison(comparison, state) {
  return (
    (state.genre === "All" || comparison.genre === state.genre) &&
    (state.decade === "all" || comparison.originalDecade === Number(state.decade))
  );
}

export function createDynasties(data) {
  const container = document.getElementById("dynasty-viz");
  const detail = document.getElementById("dynasty-detail");
  const select = document.getElementById("franchise-select");
  const count = document.getElementById("dynasty-count");
  const reading = document.getElementById("dynasty-reading");
  let mode = "revenue";
  let selectedId = data.franchises[0]?.id || null;
  let currentState = { genre: "All", decade: "all" };

  document.querySelectorAll("[data-dynasty-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.dynastyMode;
      setActiveButtons("[data-dynasty-mode]", mode, "dynastyMode");
      render(currentState);
    });
  });
  select.addEventListener("change", () => {
    selectedId = select.value;
    render(currentState);
  });

  function metricValue(comparison, type) {
    if (type === "roi") {
      return [comparison.originalRoi, comparison.sequelRoi];
    }
    if (type === "rating") {
      return [comparison.originalRating, comparison.sequelRating];
    }
    return [comparison.originalRevenue, comparison.sequelRevenue];
  }

  function eligibleForMode(comparison) {
    if (mode !== "rating") {
      return true;
    }
    return (
      comparison.originalRating != null &&
      comparison.sequelRating != null &&
      comparison.originalRatingVotes >= 50 &&
      comparison.sequelRatingVotes >= 50
    );
  }

  function filmMetric(film) {
    if (mode === "roi") {
      return film.roi;
    }
    if (mode === "rating") {
      return film.rating;
    }
    return film.revenue;
  }

  function formatMetric(value) {
    if (mode === "roi") {
      return formatRoi(value);
    }
    if (mode === "rating") {
      return `${value.toFixed(2)} / 5`;
    }
    return formatMoney(value);
  }

  function metricDelta(value, baseline) {
    if (mode === "rating") {
      const change = value - baseline;
      return `${change >= 0 ? "+" : ""}${change.toFixed(2)} points`;
    }
    return formatPercent(value / baseline - 1, 0);
  }

  function renderReel(franchise) {
    if (!franchise) {
      detail.innerHTML = `
        <p class="section-label">FRANCHISE REEL</p>
        <h3>No collection available</h3>
        <p class="muted">Widen the shared filters to inspect a chronological franchise record.</p>
      `;
      return;
    }
    const installments = franchise.installments.filter((film) => (
      mode !== "rating" || (film.rating != null && film.ratingVotes >= 50)
    )).sort((first, second) => first.order - second.order);
    const original = installments.find((film) => film.id === franchise.original.id);
    if (!original) {
      renderReel(null);
      return;
    }
    const sequels = installments.filter((film) => film.id !== original.id);
    const improved = sequels.filter((film) => filmMetric(film) > filmMetric(original)).length;
    const label = mode === "revenue" ? "GROSS" : mode === "roi" ? "ROI" : "RATING";
    const peak = d3.greatest(installments, filmMetric);
    detail.innerHTML = `
      <div class="radial-header">
        <p class="section-label">FRANCHISE REEL · ${label}</p>
        <h3>${franchise.name}</h3>
        <p>${formatInteger(installments.length)} VISIBLE ELIGIBLE OF ${formatInteger(franchise.knownInstallments)} KNOWN INSTALLMENTS</p>
      </div>
      <div id="franchise-reel-viz"></div>
      <div class="metric-grid">
        <div><strong>${formatMoney(franchise.totalRevenue)}</strong><span>TOTAL GROSS</span></div>
        <div><strong>${formatPercent(improved / sequels.length)}</strong><span>ABOVE ORIGINAL · ${label}</span></div>
        <div><strong>${limitText(peak.title, 18)}</strong><span>PEAK INSTALLMENT</span></div>
        <div><strong>${formatMetric(filmMetric(peak))}</strong><span>PEAK ${label}</span></div>
      </div>
    `;
    const reelContainer = detail.querySelector("#franchise-reel-viz");
    const width = 326;
    const height = 287;
    const margin = { top: 25, right: 13, bottom: 55, left: 54 };
    const values = installments.map(filmMetric);
    const x = d3
      .scalePoint()
      .domain(installments.map((film) => film.id))
      .range([margin.left, width - margin.right])
      .padding(0.45);
    const numericExtent = d3.extent(values);
    const logExtent = numericExtent.map((value) => Math.log10(value));
    const logPadding = Math.max(0.08, (logExtent[1] - logExtent[0]) * 0.12);
    const y = mode === "rating"
      ? d3.scaleLinear().domain([1, 5]).range([height - margin.bottom, margin.top])
      : d3.scaleLog()
        .domain([10 ** (logExtent[0] - logPadding), 10 ** (logExtent[1] + logPadding)])
        .range([height - margin.bottom, margin.top]);
    const milestones = mode === "rating"
      ? [1, 2, 3, 4, 5]
      : mode === "roi"
        ? [0.1, 0.5, 1, 2, 5, 10, 50, 100, 500, 1000, 5000, 10000]
        : [1e4, 5e4, 1e5, 5e5, 1e6, 5e6, 1e7, 5e7, 1e8, 5e8, 1e9, 2e9, 5e9];
    const candidateTicks = milestones.filter((value) => value >= y.domain()[0] && value <= y.domain()[1]);
    const tickValues = candidateTicks.length <= 4
      ? candidateTicks
      : [candidateTicks[0], candidateTicks[Math.floor(candidateTicks.length / 3)], candidateTicks[Math.floor((candidateTicks.length * 2) / 3)], candidateTicks.at(-1)];
    const radius = d3.scaleSqrt().domain(d3.extent(installments, (film) => film.revenue)).range([4, 11]);
    const svg = d3.select(reelContainer).append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickValues(tickValues).tickSize(-(width - margin.left - margin.right)).tickFormat(""));
    svg
      .append("line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", y(filmMetric(original)))
      .attr("y2", y(filmMetric(original)))
      .attr("stroke", "#b8a060")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 4");
    svg
      .append("text")
      .attr("class", "zone-label")
      .attr("x", width - margin.right)
      .attr("y", y(filmMetric(original)) - 7)
      .attr("text-anchor", "end")
      .text(`ORIGINAL · ${formatMetric(filmMetric(original))}`);
    svg
      .append("path")
      .datum(installments)
      .attr("d", d3.line()
        .x((film) => x(film.id))
        .y((film) => y(filmMetric(film)))
        .curve(d3.curveMonotoneX))
      .attr("fill", "none")
      .attr("stroke", "#c9843a")
      .attr("stroke-width", 2.2);
    const nodes = svg
      .append("g")
      .selectAll("g")
      .data(installments)
      .join("g")
      .attr("transform", (film) => `translate(${x(film.id)},${y(filmMetric(film))})`)
      .style("cursor", "pointer")
      .on("mouseenter", (event, film) => {
        const previous = installments.find((entry) => entry.order === film.order - 1);
        showTooltip(event, film.title, [
          ["Installment", `#${film.order}`],
          [label, formatMetric(filmMetric(film))],
          ["vs original", metricDelta(filmMetric(film), filmMetric(original)), filmMetric(film) >= filmMetric(original) ? "positive" : "negative"],
          ["vs previous", previous ? metricDelta(filmMetric(film), filmMetric(previous)) : "opening film"],
          ["ROI", formatRoi(film.roi)],
        ]);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);
    nodes
      .append("circle")
      .attr("r", (film) => radius(film.revenue))
      .attr("fill", (film) => film.id === original.id ? COLORS[original.genre] || "#c9843a" : filmMetric(film) >= filmMetric(original) ? "#4a9e78" : "#b54a3a")
      .attr("stroke", (film) => film.id === peak.id ? "#d4a830" : "var(--paper-3)")
      .attr("stroke-width", (film) => film.id === peak.id ? 2 : 0.8)
      .attr("opacity", 0.92);
    nodes
      .append("text")
      .attr("class", "chart-label")
      .attr("y", (film) => radius(film.revenue) + 15)
      .attr("text-anchor", "middle")
      .text((film) => `#${film.order}`);
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickValues(tickValues).tickFormat(formatMetric));
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", width / 2)
      .attr("y", height - 11)
      .attr("text-anchor", "middle")
      .text("INSTALLMENT ORDER · HOVER FOR PREVIOUS CHANGE");
  }

  function render(state) {
    currentState = state;
    let comparisons = data.comparisons
      .filter((comparison) => matchesComparison(comparison, state))
      .filter(eligibleForMode);
    const visibleFranchiseIds = new Set(comparisons.map((comparison) => comparison.franchiseId));
    const visibleFranchises = data.franchises.filter((franchise) => visibleFranchiseIds.has(franchise.id));
    if (!visibleFranchiseIds.has(selectedId)) {
      selectedId = visibleFranchises[0]?.id || null;
    }
    select.innerHTML = visibleFranchises
      .map((franchise) => `<option value="${franchise.id}">${franchise.name}</option>`)
      .join("");
    if (selectedId) {
      select.value = selectedId;
    }
    count.textContent = `${formatInteger(comparisons.length)} sequels · ${formatInteger(visibleFranchises.length)} collections`;
    container.replaceChildren();

    const width = Math.max(container.clientWidth, 590);
    const height = 510;
    if (!comparisons.length) {
      d3.select(container)
        .append("div")
        .attr("class", "annotation")
        .style("padding", "54px 22px")
        .text("No franchise sequel comparisons are available under these filters.");
      reading.textContent = "No sequel comparison remains under these filters; widen the cut to inspect franchise performance.";
      renderReel(null);
      return;
    }
    const margin = { top: 35, right: 30, bottom: 62, left: 78 };
    const values = comparisons.flatMap((comparison) => metricValue(comparison, mode));
    const x = mode === "rating"
      ? d3.scaleLinear().domain([1, 5]).range([margin.left, width - margin.right])
      : d3.scaleLog().domain(d3.extent(values)).nice().range([margin.left, width - margin.right]);
    const y = mode === "rating"
      ? d3.scaleLinear().domain([1, 5]).range([height - margin.bottom, margin.top])
      : d3.scaleLog().domain(d3.extent(values)).nice().range([height - margin.bottom, margin.top]);
    const radius = d3
      .scaleSqrt()
      .domain(d3.extent(comparisons, (comparison) => comparison.budget))
      .range([3, 12]);
    const metricLabel = mode === "revenue" ? "REVENUE" : mode === "roi" ? "ROI" : "MOVIELENS RATING";
    const axisFormatter = mode === "revenue"
      ? formatMoney
      : mode === "roi"
        ? formatRoi
        : (value) => value.toFixed(1);
    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("aria-label", "Original versus sequel performance plot");
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(-(height - margin.top - margin.bottom)).tickFormat(""));
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-(width - margin.left - margin.right)).tickFormat(""));
    const equalityDomain = mode === "rating" ? [1, 5] : [
      Math.max(x.domain()[0], y.domain()[0]),
      Math.min(x.domain()[1], y.domain()[1]),
    ];
    svg
      .append("line")
      .attr("x1", x(equalityDomain[0]))
      .attr("x2", x(equalityDomain[1]))
      .attr("y1", y(equalityDomain[0]))
      .attr("y2", y(equalityDomain[1]))
      .attr("stroke", "#b8a060")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "7 5");
    svg
      .append("text")
      .attr("class", "zone-label")
      .attr("x", margin.left + 13)
      .attr("y", margin.top + 19)
      .text("SEQUEL IMPROVED");
    svg
      .append("text")
      .attr("class", "zone-label")
      .attr("x", width - margin.right - 120)
      .attr("y", height - margin.bottom - 13)
      .text("SEQUEL DECLINED");
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(axisFormatter));
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat(axisFormatter));
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", width / 2)
      .attr("y", height - 11)
      .attr("text-anchor", "middle")
      .text(`ORIGINAL ${metricLabel}`);
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .text(`SEQUEL ${metricLabel}`);

    const points = svg
      .append("g")
      .selectAll("circle")
      .data(comparisons)
      .join("circle")
      .attr("cx", (comparison) => x(metricValue(comparison, mode)[0]))
      .attr("cy", (comparison) => y(metricValue(comparison, mode)[1]))
      .attr("r", (comparison) => radius(comparison.budget))
      .attr("fill", (comparison) => metricValue(comparison, mode)[1] >= metricValue(comparison, mode)[0] ? "#4a9e78" : "#b54a3a")
      .attr("opacity", (comparison) => selectedId && comparison.franchiseId !== selectedId ? 0.28 : 0.78)
      .attr("stroke", (comparison) => comparison.franchiseId === selectedId ? "#8b6410" : "none")
      .attr("stroke-width", 1.8)
      .style("cursor", "pointer")
      .on("mouseenter", (event, comparison) => {
        const [original, sequel] = metricValue(comparison, mode);
        showTooltip(event, comparison.collection, [
          ["Original", limitText(comparison.originalTitle, 25)],
          [`#${comparison.installment}`, limitText(comparison.title, 25)],
          [`Original ${metricLabel}`, axisFormatter(original)],
          [`Sequel ${metricLabel}`, axisFormatter(sequel), sequel >= original ? "positive" : "negative"],
        ]);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip)
      .on("click", (_, comparison) => {
        selectedId = comparison.franchiseId;
        render(state);
      });
    points
      .filter((comparison) => comparison.franchiseId === selectedId)
      .raise();

    const improving = comparisons.filter((comparison) => {
      const [original, sequel] = metricValue(comparison, mode);
      return sequel >= original;
    }).length;
    const collectionsWithoutGain = d3
      .groups(comparisons, (comparison) => comparison.franchiseId)
      .filter(([, entries]) => !entries.some((comparison) => {
        const [original, sequel] = metricValue(comparison, mode);
        return sequel >= original;
      })).length;
    reading.textContent = `Across ${formatInteger(visibleFranchises.length)} visible collections, only ${formatPercent(improving / comparisons.length)} of ${formatInteger(comparisons.length)} sequels meet or exceed their original on ${metricLabel.toLowerCase()}; ${formatPercent(collectionsWithoutGain / visibleFranchises.length)} of collections never manage it once. The chronological reel matters because a series can peak late, decline gradually, or briefly recover rather than follow a single sequel rule.`;
    renderReel(visibleFranchises.find((franchise) => franchise.id === selectedId));
  }

  return { render };
}
