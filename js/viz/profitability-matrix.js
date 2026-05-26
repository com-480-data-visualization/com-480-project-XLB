import {
  MATRIX_GENRES,
  TIERS,
  TIER_LABELS,
  d3,
  filterMovies,
  formatInteger,
  formatPercent,
  formatRoi,
  hideTooltip,
  median,
  motionDuration,
  moveTooltip,
  setActiveButtons,
  showTooltip,
} from "../utils.js?v=20260526-final3";

function kernelDensity(values, thresholds, bandwidth) {
  return thresholds.map((threshold) => [
    threshold,
    d3.mean(values, (value) => {
      const distance = (threshold - value) / bandwidth;
      return Math.abs(distance) <= 1 ? (0.75 * (1 - distance * distance)) / bandwidth : 0;
    }) || 0,
  ]);
}

export function createProfitabilityMatrix(movies) {
  const container = document.getElementById("matrix-viz");
  const detail = document.getElementById("matrix-detail");
  const count = document.getElementById("matrix-count");
  const reading = document.getElementById("matrix-reading");
  const decoder = document.getElementById("matrix-decoder");
  let mode = "median";
  let selection = null;
  let currentState = { genre: "All", decade: "all" };

  document.querySelectorAll("[data-matrix-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.matrixMode;
      setActiveButtons("[data-matrix-mode]", mode, "matrixMode");
      render(currentState);
    });
  });

  function visibleRows(state) {
    if (state.genre === "All") {
      return MATRIX_GENRES;
    }
    return [state.genre];
  }

  function cellData(visible, genre, tier) {
    const films = visible.filter((movie) => movie.genre === genre && movie.tier === tier);
    return {
      genre,
      tier,
      films,
      count: films.length,
      medianRoi: median(films.map((movie) => movie.roi)),
      profitable: films.length ? films.filter((movie) => movie.roi >= 1).length / films.length : null,
    };
  }

  function renderDetail(cell, visible) {
    if (!cell || !cell.count) {
      reading.textContent = "No genre-budget pairing is available in this cut; widen the shared filters to compare strategies.";
      detail.innerHTML = `
        <p class="section-label">CELL DRILL-DOWN</p>
        <h3>No films in this cell</h3>
        <p class="muted">Choose a populated genre and budget combination.</p>
      `;
      return;
    }

    const overallMedian = median(visible.map((movie) => movie.roi));
    const overallProfitable = visible.filter((movie) => movie.roi >= 1).length / visible.length;
    const reliableCells = MATRIX_GENRES.flatMap((genre) => TIERS.map((tier) => cellData(visible, genre, tier)))
      .filter((candidate) => candidate.count >= 10);
    const metricValue = (candidate) => mode === "median" ? candidate.medianRoi : candidate.profitable;
    const strongest = d3.greatest(reliableCells, metricValue);
    const weakest = d3.least(reliableCells, metricValue);
    if (mode === "median") {
      const selectedComparison = cell.medianRoi >= overallMedian ? "above" : "below";
      reading.textContent = strongest && weakest
        ? `Among strategies with at least ten visible films, ${strongest.genre} at ${TIER_LABELS[strongest.tier].toLowerCase()} leads with ${formatRoi(strongest.medianRoi)} median return, while ${weakest.genre} at ${TIER_LABELS[weakest.tier].toLowerCase()} sits at ${formatRoi(weakest.medianRoi)}. The selected ${cell.genre} cell is ${selectedComparison} the full-cut baseline of ${formatRoi(overallMedian)}, and its violin shows whether that summary is broad or fragile.`
        : `The selected ${cell.genre} strategy records ${formatRoi(cell.medianRoi)} median return across ${formatInteger(cell.count)} films, ${selectedComparison} the visible baseline of ${formatRoi(overallMedian)}.`;
    } else {
      const selectedComparison = cell.profitable >= overallProfitable ? "above" : "below";
      reading.textContent = strongest && weakest
        ? `Measured by the share that recovers its recorded budget, ${strongest.genre} at ${TIER_LABELS[strongest.tier].toLowerCase()} leads reliable cells at ${formatPercent(strongest.profitable)}, compared with ${formatPercent(weakest.profitable)} for ${weakest.genre} at ${TIER_LABELS[weakest.tier].toLowerCase()}. The selected cell is ${selectedComparison} the visible baseline of ${formatPercent(overallProfitable)}.`
        : `The selected ${cell.genre} cell recovers its reported budget in ${formatPercent(cell.profitable)} of films, ${selectedComparison} the visible baseline of ${formatPercent(overallProfitable)}.`;
    }
    detail.innerHTML = `
      <p class="section-label">CELL DRILL-DOWN</p>
      <h3>${cell.genre} · ${cell.tier}</h3>
      <p class="muted">${formatInteger(cell.count)} films under the visible filters.</p>
      <div id="violin-viz"></div>
      <div class="metric-grid">
        <div><strong>${formatRoi(cell.medianRoi)}</strong><span>MEDIAN ROI</span></div>
        <div><strong>${formatPercent(cell.profitable)}</strong><span>PROFITABLE</span></div>
        <div><strong>${formatRoi(overallMedian)}</strong><span>VISIBLE BASELINE</span></div>
        <div><strong>${cell.medianRoi > overallMedian ? "ABOVE" : "BELOW"}</strong><span>BASELINE</span></div>
      </div>
    `;
    const violin = detail.querySelector("#violin-viz");
    const width = 242;
    const height = 198;
    const margin = { top: 12, right: 22, bottom: 29, left: 39 };
    const cap = d3.quantile(visible.map((movie) => movie.roi).sort(d3.ascending), 0.98) || 10;
    const baselineValues = visible.map((movie) => Math.log10(Math.min(movie.roi, cap)));
    const cellValues = cell.films.map((movie) => Math.log10(Math.min(movie.roi, cap)));
    const domain = [Math.log10(0.05), Math.log10(cap)];
    const thresholds = d3.range(domain[0], domain[1] + 0.001, (domain[1] - domain[0]) / 30);
    const baselineDensity = kernelDensity(baselineValues, thresholds, 0.21);
    const cellDensity = kernelDensity(cellValues, thresholds, 0.21);
    const maximum = d3.max([...baselineDensity, ...cellDensity], (point) => point[1]) || 1;
    const y = d3.scaleLinear().domain(domain).range([height - margin.bottom, margin.top]);
    const spread = d3.scaleLinear().domain([0, maximum]).range([0, 61]);
    const center = (margin.left + width - margin.right) / 2;
    const shape = (density) => d3
      .area()
      .curve(d3.curveCatmullRom)
      .x0((point) => center - spread(point[1]))
      .x1((point) => center + spread(point[1]))
      .y((point) => y(point[0]))(density);
    const svg = d3.select(violin).append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    const detailDuration = motionDuration(600);
    const baselineShape = detailDuration
      ? d3.area()
        .x0(center)
        .x1(center)
        .y((point) => y(point[0]))(baselineDensity)
      : shape(baselineDensity);
    const selectedShape = detailDuration
      ? d3.area()
        .x0(center)
        .x1(center)
        .y((point) => y(point[0]))(cellDensity)
      : shape(cellDensity);
    svg
      .append("path")
      .attr("d", baselineShape)
      .attr("fill", "#c8b898")
      .attr("opacity", detailDuration ? 0 : 0.32)
      .transition()
      .duration(detailDuration)
      .attr("d", shape(baselineDensity))
      .attr("opacity", 0.32);
    svg
      .append("path")
      .attr("d", selectedShape)
      .attr("fill", "#c9843a")
      .attr("opacity", detailDuration ? 0 : 0.62)
      .transition()
      .delay(detailDuration ? 80 : 0)
      .duration(detailDuration)
      .attr("d", shape(cellDensity))
      .attr("opacity", 0.62);
    const medianY = y(Math.log10(Math.min(cell.medianRoi, cap)));
    svg
      .append("line")
      .attr("x1", detailDuration ? center : center - 66)
      .attr("x2", detailDuration ? center : center + 66)
      .attr("y1", medianY)
      .attr("y2", medianY)
      .attr("stroke", "#8b6410")
      .attr("stroke-width", 1.5)
      .transition()
      .delay(detailDuration ? 260 : 0)
      .duration(motionDuration(360))
      .attr("x1", center - 66)
      .attr("x2", center + 66);
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3.axisLeft(y)
          .tickValues([0.1, 1, 10, 100, 1000].filter((value) => value <= cap))
          .tickFormat(formatRoi)
          .tickSize(0),
      );
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", center)
      .attr("y", height - 8)
      .attr("text-anchor", "middle")
      .text("ROI DISTRIBUTION");
  }

  function render(state) {
    currentState = state;
    const visible = filterMovies(movies, state);
    decoder.textContent = mode === "median"
      ? "MEDIAN ROI 3.0x = HALF THE CELL REACHED AT LEAST 3x BUDGET · CLICK CELL FOR DISTRIBUTION · CHANGE DECADE TO TEST THE PATTERN"
      : "% PROFITABLE = SHARE GROSSING AT LEAST THE RECORDED BUDGET · CLICK CELL FOR DISTRIBUTION · CHANGE DECADE TO TEST THE PATTERN";
    const genres = visibleRows(state);
    const cells = genres.flatMap((genre) => TIERS.map((tier) => cellData(visible, genre, tier)));
    const populated = cells.filter((cell) => cell.count);
    count.textContent = `${formatInteger(visible.length)} films`;
    const retainedSelection = selection
      ? cells.find((cell) => cell.genre === selection.genre && cell.tier === selection.tier && cell.count)
      : null;
    selection = retainedSelection || d3.greatest(populated, (cell) => cell.medianRoi);
    container.replaceChildren();

    const width = Math.max(container.clientWidth, 530);
    const rowHeight = genres.length === 1 ? 84 : 49;
    const height = 85 + genres.length * rowHeight + 47;
    const margin = { top: 67, right: 18, bottom: 34, left: 115 };
    const cellWidth = (width - margin.left - margin.right) / TIERS.length;
    const values = populated.map((cell) => mode === "median" ? cell.medianRoi : cell.profitable);
    const maximum = mode === "median"
      ? d3.quantile(values.sort(d3.ascending), 0.92) || 1
      : 1;
    const color = mode === "median"
      ? d3.scaleSequential([0, maximum], d3.interpolateRgb("#f2e6d1", "#8b6410")).clamp(true)
      : d3.scaleSequential([0, 1], d3.interpolateRgb("#f2e6d1", "#8b6410"));
    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("aria-label", "Genre and budget tier profitability matrix");

    TIERS.forEach((tier, index) => {
      const words = TIER_LABELS[tier].split(" ");
      svg
        .append("text")
        .attr("class", "chart-label")
        .attr("x", margin.left + index * cellWidth + cellWidth / 2)
        .attr("y", 29)
        .attr("text-anchor", "middle")
        .text(words[0]);
      svg
        .append("text")
        .attr("class", "zone-label")
        .attr("x", margin.left + index * cellWidth + cellWidth / 2)
        .attr("y", 45)
        .attr("text-anchor", "middle")
        .text(words.slice(1).join(" "));
    });

    const rows = svg
      .append("g")
      .selectAll("g")
      .data(cells)
      .join("g");
    const cellDuration = motionDuration(530);
    const cellX = (cell) => margin.left + TIERS.indexOf(cell.tier) * cellWidth + 2;
    const cellY = (cell) => margin.top + genres.indexOf(cell.genre) * rowHeight + 2;
    const cellHeight = rowHeight - 5;
    const rectangles = rows
      .append("rect")
      .attr("x", cellX)
      .attr("y", (cell) => cellDuration ? cellY(cell) + cellHeight / 2 : cellY(cell))
      .attr("width", cellWidth - 5)
      .attr("height", cellDuration ? 0 : cellHeight)
      .attr("rx", 2)
      .attr("fill", (cell) => cell.count ? color(mode === "median" ? cell.medianRoi : cell.profitable) : "transparent")
      .attr("fill-opacity", cellDuration ? 0 : 1)
      .attr("stroke", (cell) => cell === selection ? "#8b6410" : cell.count ? "#e0cfb2" : "#ddd0b0")
      .attr("stroke-width", (cell) => cell === selection ? 2 : 1)
      .style("cursor", (cell) => cell.count ? "pointer" : "default")
      .on("mouseenter", function onEnter(event, cell) {
        if (!cell.count) {
          return;
        }
        d3.select(this)
          .interrupt("cell-focus")
          .transition("cell-focus")
          .duration(motionDuration(120))
          .attr("stroke", "#d4a830")
          .attr("stroke-width", 2.2);
        showTooltip(event, `${cell.genre} · ${TIER_LABELS[cell.tier]}`, [
          ["Films", formatInteger(cell.count)],
          ["Median ROI", formatRoi(cell.medianRoi)],
          ["Profitable", formatPercent(cell.profitable)],
          ["Open", "Click for distribution"],
        ]);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", function onLeave(_, cell) {
        d3.select(this)
          .interrupt("cell-focus")
          .transition("cell-focus")
          .duration(motionDuration(130))
          .attr("stroke", cell === selection ? "#8b6410" : cell.count ? "#e0cfb2" : "#ddd0b0")
          .attr("stroke-width", cell === selection ? 2 : 1);
        hideTooltip();
      })
      .on("click", (_, cell) => {
        if (cell.count) {
          hideTooltip();
          selection = cell;
          render(state);
        }
      });
    rectangles
      .transition()
      .delay((cell) => cellDuration ? (genres.indexOf(cell.genre) * 42) + (TIERS.indexOf(cell.tier) * 34) : 0)
      .duration(cellDuration)
      .ease(d3.easeCubicOut)
      .attr("y", cellY)
      .attr("height", cellHeight)
      .attr("fill-opacity", 1);
    const valuesText = rows
      .filter((cell) => cell.count)
      .append("text")
      .attr("x", (cell) => margin.left + TIERS.indexOf(cell.tier) * cellWidth + cellWidth / 2)
      .attr("y", (cell) => margin.top + genres.indexOf(cell.genre) * rowHeight + rowHeight / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", (cell) => (mode === "median" ? cell.medianRoi / maximum : cell.profitable) > 0.56 ? "#faf6ec" : "#4b3923")
      .attr("font-family", "DM Mono, monospace")
      .attr("font-size", 13)
      .attr("opacity", cellDuration ? 0 : 1)
      .text((cell) => mode === "median" ? formatRoi(cell.medianRoi) : formatPercent(cell.profitable));
    const countsText = rows
      .filter((cell) => cell.count)
      .append("text")
      .attr("class", "chart-label")
      .attr("x", (cell) => margin.left + TIERS.indexOf(cell.tier) * cellWidth + cellWidth / 2)
      .attr("y", (cell) => margin.top + genres.indexOf(cell.genre) * rowHeight + rowHeight - 12)
      .attr("text-anchor", "middle")
      .attr("opacity", cellDuration ? 0 : 1)
      .text((cell) => `n=${formatInteger(cell.count)}`);
    valuesText
      .transition()
      .delay((cell) => cellDuration ? 250 + (genres.indexOf(cell.genre) * 42) + (TIERS.indexOf(cell.tier) * 34) : 0)
      .duration(motionDuration(300))
      .attr("opacity", 1);
    countsText
      .transition()
      .delay((cell) => cellDuration ? 310 + (genres.indexOf(cell.genre) * 42) + (TIERS.indexOf(cell.tier) * 34) : 0)
      .duration(motionDuration(270))
      .attr("opacity", 1);
    genres.forEach((genre, index) => {
      svg
        .append("text")
        .attr("class", "chart-label")
        .attr("x", margin.left - 13)
        .attr("y", margin.top + index * rowHeight + rowHeight / 2)
        .attr("dominant-baseline", "middle")
        .attr("text-anchor", "end")
        .text(genre.toUpperCase());
    });

    renderDetail(selection, visible);
  }

  return { render };
}
