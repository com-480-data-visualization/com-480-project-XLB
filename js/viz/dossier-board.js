import {
  COLORS,
  dossierDisplaySample,
  d3,
  filmTooltip,
  filterMovies,
  formatCorrelation,
  formatInteger,
  formatMoney,
  formatPercent,
  formatRoi,
  hideTooltip,
  median,
  motionDuration,
  moveTooltip,
  regression,
  renderLegend,
  roiForLogScale,
  setActiveButtons,
} from "../utils.js?v=20260526-final6";

export function createDossierBoard(movies) {
  const container = document.getElementById("dossier-viz");
  const count = document.getElementById("dossier-count");
  const metricLabel = document.getElementById("dossier-metric-label");
  const searchInput = document.getElementById("film-search");
  const brushToggle = document.getElementById("brush-toggle");
  const brushResult = document.getElementById("brush-result");
  const reading = document.getElementById("dossier-reading");
  const allExtent = {
    budget: d3.extent(movies, (movie) => movie.budget),
    revenue: d3.extent(movies, (movie) => movie.revenue),
  };

  let mode = "revenue";
  let brushEnabled = false;
  let currentState = { genre: "All", decade: "all" };

  renderLegend(document.getElementById("dossier-legend"));

  document.querySelectorAll("[data-dossier-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.dossierMode;
      setActiveButtons("[data-dossier-mode]", mode, "dossierMode");
      render(currentState);
    });
  });

  searchInput.addEventListener("input", () => render(currentState));
  brushToggle.addEventListener("click", () => {
    brushEnabled = !brushEnabled;
    brushToggle.classList.toggle("active", brushEnabled);
    brushToggle.textContent = brushEnabled ? "Clear brush" : "Brush select";
    brushResult.textContent = brushEnabled
      ? "Drag across bubbles to open a selection dossier."
      : "Drag on the chart to inspect a selection of films.";
    render(currentState);
  });

  function render(state) {
    currentState = state;
    const eligible = filterMovies(movies, state);
    const term = searchInput.value.trim().toLowerCase();
    const sample = dossierDisplaySample(eligible, 800, term);
    const shown = sample.movies;
    const revenueFloor = 10_000;
    const pinnedRevenueCount = eligible.filter((movie) => movie.revenue < revenueFloor).length;
    const width = Math.max(container.clientWidth, 460);
    const height = Math.max(500, Math.min(590, window.innerHeight * 0.67));
    const margin = { top: 30, right: 34, bottom: 60, left: 78 };

    container.replaceChildren();
    const largestGross = d3.greatest(eligible, (movie) => movie.revenue);
    const strongestReturn = d3.greatest(eligible, (movie) => movie.roi);
    const relation = regression(eligible.map((movie) => ({
      x: Math.log10(movie.budget),
      y: Math.log10(movie.revenue),
    })));
    const roiRelation = regression(eligible.map((movie) => ({
      x: Math.log10(movie.budget),
      y: Math.log10(roiForLogScale(movie.roi)),
    })));
    const recovering = eligible.length
      ? eligible.filter((movie) => movie.roi >= 1).length / eligible.length
      : null;
    const microReturn = median(eligible.filter((movie) => movie.tier === "Micro").map((movie) => movie.roi));
    const blockbusterReturn = median(eligible.filter((movie) => movie.tier === "Blockbuster").map((movie) => movie.roi));
    const scaleComparison = microReturn != null && blockbusterReturn != null
      ? ` Median return is ${formatRoi(microReturn)} for micro-budget films versus ${formatRoi(blockbusterReturn)} for blockbusters: the smaller-budget segment multiplies its recorded cost more effectively even while blockbusters reach larger grosses.`
      : "";
    const lensReading = !eligible.length ? "" : mode === "revenue"
      ? `On the box-office lens, ${largestGross.title} reaches ${formatMoney(largestGross.revenue)}; switch to ROI and ${strongestReturn.title} becomes the exceptional return at ${formatRoi(strongestReturn.roi)}.`
      : `The ROI lens promotes efficiency over scale: ${strongestReturn.title} reaches ${formatRoi(strongestReturn.roi)}, while the budget-to-return relationship is ${formatCorrelation(roiRelation?.correlation)}; switch back to Revenue to locate ${largestGross.title}'s ${formatMoney(largestGross.revenue)} gross.`;
    reading.textContent = eligible.length
      ? `Budget and gross move together in this cut (${formatCorrelation(relation?.correlation)}), yet only ${formatPercent(recovering)} of films recover their reported production budget.${scaleComparison} ${lensReading}`
      : "No financial releases remain in this cut; widen the shared filters to restore the board.";
    metricLabel.textContent = mode.toUpperCase();
    count.textContent = sample.sampled
      ? `${formatInteger(shown.length)} shown / ${formatInteger(eligible.length)} eligible`
      : `${formatInteger(eligible.length)} eligible films`;
    if (!brushEnabled) {
      const samplingNote = sample.sampled
        ? `Showing a stratified ${formatInteger(shown.length)}-film display sample; summaries use all ${formatInteger(eligible.length)} eligible films. Activate the brush to inspect marks.`
        : `All ${formatInteger(eligible.length)} matching films are displayed. Activate the brush to inspect a selection.`;
      const floorNote = mode === "revenue" && pinnedRevenueCount
        ? ` ${formatInteger(pinnedRevenueCount)} reported grosses below $10K are pinned to the baseline.`
        : "";
      brushResult.textContent = `${samplingNote}${floorNote}`;
    }

    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("aria-label", "Movie budget and performance scatter plot");

    const x = d3
      .scaleLog()
      .domain([Math.max(10_000, allExtent.budget[0]), allExtent.budget[1]])
      .range([margin.left, width - margin.right])
      .nice();
    const revenueY = d3
      .scaleLog()
      .domain([revenueFloor, allExtent.revenue[1]])
      .range([height - margin.bottom, margin.top])
      .nice()
      .clamp(true);
    const roiLimit = Math.max(100, d3.quantile(eligible.map((movie) => movie.roi).sort(d3.ascending), 0.985) || 100);
    const roiY = d3
      .scaleLog()
      .domain([0.04, roiLimit])
      .range([height - margin.bottom, margin.top])
      .nice()
      .clamp(true);
    const y = mode === "revenue" ? revenueY : roiY;

    const xTicks = [1e4, 1e5, 1e6, 1e7, 1e8, 1e9].filter((value) => value <= x.domain()[1]);
    const yTicks = mode === "revenue"
      ? [1e5, 1e6, 1e7, 1e8, 1e9].filter((value) => value >= y.domain()[0] && value <= y.domain()[1])
      : [0.1, 0.5, 1, 3, 10, 100, 1000].filter((value) => value >= y.domain()[0] && value <= y.domain()[1]);

    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickValues(xTicks).tickSize(-(height - margin.top - margin.bottom)).tickFormat(""));
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickValues(yTicks).tickSize(-(width - margin.left - margin.right)).tickFormat(""));

    if (mode === "revenue") {
      const lower = Math.max(x.domain()[0], y.domain()[0]);
      const upper = Math.min(x.domain()[1], y.domain()[1]);
      svg
        .append("line")
        .attr("x1", x(lower))
        .attr("x2", x(upper))
        .attr("y1", y(lower))
        .attr("y2", y(upper))
        .attr("stroke", "#b8a060")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "7 5");
      svg
        .append("text")
        .attr("class", "zone-label")
        .attr("x", x(upper) - 10)
        .attr("y", y(upper) + 17)
        .attr("text-anchor", "end")
        .text("BREAK-EVEN");
      [
        ["MICRO-BUDGET BREAKOUTS", margin.left + 16, margin.top + 25],
        ["BLOCKBUSTERS", width - margin.right - 125, margin.top + 25],
        ["CULT LOSSES", margin.left + 18, height - margin.bottom - 18],
        ["BIG-BUDGET DISAPPOINTMENTS", width - margin.right - 190, height - margin.bottom - 18],
      ].forEach(([label, left, top]) => {
        svg.append("text").attr("class", "zone-label").attr("x", left).attr("y", top).text(label);
      });
    } else {
      svg
        .append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", y(1))
        .attr("y2", y(1))
        .attr("stroke", "#b8a060")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "7 5");
      svg
        .append("text")
        .attr("class", "zone-label")
        .attr("x", width - margin.right)
        .attr("y", y(1) - 9)
        .attr("text-anchor", "end")
        .text("RECOVERS PRODUCTION BUDGET");
    }

    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickValues(xTicks).tickFormat(formatMoney));
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickValues(yTicks).tickFormat((value) => mode === "revenue" ? formatMoney(value) : formatRoi(value)));
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", (margin.left + width - margin.right) / 2)
      .attr("y", height - 12)
      .attr("text-anchor", "middle")
      .text("PRODUCTION BUDGET");
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + height - margin.bottom) / 2)
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .text(mode === "revenue" ? "BOX OFFICE REVENUE" : "RETURN ON INVESTMENT");

    const radius = d3.scaleSqrt().domain(allExtent.budget).range([2.2, 14]);
    const isMatch = (movie) => term && movie.title.toLowerCase().includes(term);
    const baseOpacity = (movie) => {
      if (!term) {
        return 0.66;
      }
      return isMatch(movie) ? 0.96 : 0.1;
    };
    const baseStroke = (movie) => isMatch(movie) ? "var(--gold)" : "var(--paper-2)";
    const baseStrokeWidth = (movie) => isMatch(movie) ? 1.8 : 0.75;
    const revealDuration = motionDuration(680);
    const markY = (movie) => y(Math.min(mode === "roi" ? roiLimit : Infinity, mode === "roi" ? roiForLogScale(movie.roi) : movie.revenue));
    const circles = svg
      .append("g")
      .selectAll("circle")
      .data(shown, (movie) => movie.id)
      .join("circle")
      .attr("cx", (movie) => x(movie.budget))
      .attr("cy", revealDuration ? height - margin.bottom : markY)
      .attr("r", revealDuration ? 0 : (movie) => radius(movie.budget))
      .attr("fill", (movie) => COLORS[movie.genre])
      .attr("opacity", revealDuration ? 0 : baseOpacity)
      .attr("stroke", baseStroke)
      .attr("stroke-opacity", 0.84)
      .attr("stroke-width", baseStrokeWidth)
      .style("cursor", "pointer")
      .on("mouseenter", function onEnter(event, movie) {
        d3.select(this)
          .interrupt("hover-focus")
          .transition("hover-focus")
          .duration(motionDuration(110))
          .attr("r", radius(movie.budget) + 2)
          .attr("opacity", 1)
          .attr("stroke", "var(--gold)")
          .attr("stroke-width", 1.7);
        filmTooltip(event, movie);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", function onLeave(_, movie) {
        d3.select(this)
          .interrupt("hover-focus")
          .transition("hover-focus")
          .duration(motionDuration(130))
          .attr("r", radius(movie.budget))
          .attr("opacity", baseOpacity(movie))
          .attr("stroke", baseStroke(movie))
          .attr("stroke-width", baseStrokeWidth(movie));
        hideTooltip();
      });
    if (revealDuration) {
      circles
        .transition()
        .delay((movie) => ((movie.id * 17) % 190))
        .duration(revealDuration)
        .ease(d3.easeCubicOut)
        .attr("cy", markY)
        .attr("r", (movie) => radius(movie.budget))
        .attr("opacity", baseOpacity);
    }

    if (term) {
      const matches = shown.filter((movie) => movie.title.toLowerCase().includes(term)).slice(0, 4);
      const labels = svg
        .append("g")
        .selectAll("text")
        .data(matches)
        .join("text")
        .attr("class", "chart-label")
        .attr("x", (movie) => x(movie.budget) + 8)
        .attr("y", (movie) => y(mode === "roi" ? Math.min(roiForLogScale(movie.roi), roiLimit) : movie.revenue) - 8)
        .text((movie) => movie.title);
      if (revealDuration) {
        labels
          .attr("opacity", 0)
          .transition()
          .delay(420)
          .duration(250)
          .attr("opacity", 1);
      }
    }

    if (brushEnabled) {
      const brush = d3
        .brush()
        .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
        .on("end", ({ selection }) => {
          if (!selection) {
            circles
              .attr("opacity", baseOpacity)
              .attr("stroke", baseStroke)
              .attr("stroke-width", baseStrokeWidth);
            brushResult.textContent = "Drag across bubbles to open a selection dossier.";
            return;
          }
          const [[x0, y0], [x1, y1]] = selection;
          const selected = shown.filter((movie) => {
            const cx = x(movie.budget);
            const cy = y(mode === "roi" ? Math.min(roiForLogScale(movie.roi), roiLimit) : movie.revenue);
            return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
          });
          const best = d3.greatest(selected, (movie) => movie.roi);
          circles.attr("opacity", (movie) => selected.includes(movie) ? 0.9 : 0.08);
          brushResult.textContent = selected.length
            ? `${formatInteger(selected.length)} shown films selected; best return: ${best.title} at ${formatRoi(best.roi)}.`
            : "No displayed films in this selection.";
        });
      svg.append("g").attr("class", "brush").call(brush);
    }
  }

  return { render };
}
