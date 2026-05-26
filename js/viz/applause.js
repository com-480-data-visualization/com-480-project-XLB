import {
  COLORS,
  d3,
  filmTooltip,
  filterMovies,
  formatCorrelation,
  formatInteger,
  formatMoney,
  formatPercent,
  formatRoi,
  hideTooltip,
  limitText,
  median,
  motionDuration,
  moveTooltip,
  regression,
  setActiveButtons,
} from "../utils.js";

const RATING_BANDS = [
  { key: "under-2.5", label: "< 2.5", test: (rating) => rating < 2.5 },
  { key: "2.5-3.0", label: "2.5-3.0", test: (rating) => rating >= 2.5 && rating < 3 },
  { key: "3.0-3.5", label: "3.0-3.5", test: (rating) => rating >= 3 && rating < 3.5 },
  { key: "3.5-4.0", label: "3.5-4.0", test: (rating) => rating >= 3.5 && rating < 4 },
  { key: "4.0-plus", label: "4.0+", test: (rating) => rating >= 4 },
];

function sampleFilms(films, value, maximum = 52) {
  if (films.length <= maximum) {
    return films;
  }
  const sorted = films.slice().sort((first, second) => d3.ascending(value(first), value(second)));
  return d3.range(maximum).map((index) => sorted[Math.floor(((index + 0.5) / maximum) * sorted.length)]);
}

function bandStats(band, value) {
  const values = band.films.map(value).sort(d3.ascending);
  return {
    ...band,
    q10: d3.quantileSorted(values, 0.1),
    q25: d3.quantileSorted(values, 0.25),
    middle: d3.quantileSorted(values, 0.5),
    q75: d3.quantileSorted(values, 0.75),
    q90: d3.quantileSorted(values, 0.9),
    recovery: band.films.filter((movie) => movie.roi >= 1).length / band.films.length,
  };
}

export function createApplause(movies) {
  const container = document.getElementById("applause-viz");
  const count = document.getElementById("applause-count");
  const insight = document.getElementById("applause-insight");
  const reading = document.getElementById("applause-reading");
  let mode = "revenue";
  let selectedBand = "3.5-4.0";
  let currentState = { genre: "All", decade: "all" };

  document.querySelectorAll("[data-applause-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.applauseMode;
      setActiveButtons("[data-applause-mode]", mode, "applauseMode");
      render(currentState);
    });
  });

  function render(state) {
    currentState = state;
    const rated = filterMovies(movies, state).filter(
      (movie) => movie.rating != null && movie.ratingVotes >= 50,
    );
    const metric = mode === "revenue"
      ? { value: (movie) => movie.revenue, label: "BOX OFFICE", short: "gross", format: formatMoney }
      : { value: (movie) => movie.roi, label: "ROI", short: "return", format: formatRoi };
    const relation = regression(rated.map((movie) => ({
      x: movie.rating,
      y: Math.log10(metric.value(movie)),
    })));
    const groups = RATING_BANDS
      .map((band) => ({ ...band, films: rated.filter((movie) => band.test(movie.rating)) }))
      .filter((band) => band.films.length)
      .map((band) => bandStats(band, metric.value));
    count.textContent = `${formatInteger(rated.length)} films with 50+ ratings`;
    container.replaceChildren();

    if (!rated.length) {
      reading.textContent = "No film under this cut has sufficient MovieLens evidence; widen the shared filters.";
      insight.innerHTML = `<p class="section-label">AUDIENCE BAND</p><h3>No rated films</h3>`;
      d3.select(container).append("p").attr("class", "annotation").style("padding", "45px").text("No sufficiently rated films are available under these filters.");
      return;
    }
    if (!groups.some((band) => band.key === selectedBand)) {
      selectedBand = d3.greatest(groups, (band) => band.films.length).key;
    }

    const selected = groups.find((band) => band.key === selectedBand);
    const leadingMedian = d3.greatest(groups, (band) => band.middle);
    const highestRated = groups.at(-1);
    const lowestRated = groups[0];
    const topFilm = d3.greatest(selected.films, metric.value);
    const sampleMiddle = median(rated.map(metric.value));
    const selectedPosition = selected.middle >= sampleMiddle ? "above" : "below";
    insight.innerHTML = `
      <p class="section-label">SELECTED AUDIENCE BAND</p>
      <h3>${selected.label} / 5</h3>
      <p>${formatInteger(selected.films.length)} films with sufficient audience evidence.</p>
      <div class="insight-value">
        <strong>${metric.format(selected.middle)}</strong>
        <span>MEDIAN ${metric.label}</span>
      </div>
      <div class="metric-grid">
        <div><strong>${metric.format(selected.q25)}-${metric.format(selected.q75)}</strong><span>MIDDLE 50%</span></div>
        <div><strong>${formatPercent(selected.recovery)}</strong><span>RECOVER BUDGET</span></div>
      </div>
      <p class="muted">Largest ${metric.short}: ${limitText(topFilm.title, 27)} · ${metric.format(metric.value(topFilm))}</p>
    `;
    reading.textContent = `The most highly rated films do not automatically own the commercial peak. In this cut, the largest median ${metric.short} sits in the ${leadingMedian.label} rating band at ${metric.format(leadingMedian.middle)}, while the ${highestRated.label} band records ${metric.format(highestRated.middle)} and the ${lowestRated.label} band records ${metric.format(lowestRated.middle)}. Because the middle-50% bars overlap heavily and the full relationship is ${formatCorrelation(relation?.correlation)}, applause identifies audience approval more reliably than financial certainty. The selected band sits ${selectedPosition} the full rated-sample median.`;

    const width = Math.max(container.clientWidth, 620);
    const height = 505;
    const margin = { top: 70, right: 46, bottom: 60, left: 125 };
    const rawValues = rated.map(metric.value).sort(d3.ascending);
    const lower = d3.min(rawValues);
    const upper = mode === "roi" ? d3.quantile(rawValues, 0.985) : d3.max(rawValues);
    const x = d3.scaleLog().domain([lower, upper]).nice().clamp(true).range([margin.left, width - margin.right]);
    const ordered = groups.slice().reverse();
    const y = d3.scaleBand()
      .domain(ordered.map((band) => band.key))
      .range([margin.top, height - margin.bottom])
      .padding(0.28);
    const ticks = mode === "revenue"
      ? [1e4, 1e5, 1e6, 1e7, 1e8, 1e9].filter((value) => value >= x.domain()[0] && value <= x.domain()[1])
      : [0.1, 0.5, 1, 3, 10, 100, 1000].filter((value) => value >= x.domain()[0] && value <= x.domain()[1]);
    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("aria-label", "Commercial ranges across MovieLens audience rating bands");
    const revealDuration = motionDuration(600);
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", margin.left)
      .attr("y", 24)
      .text("DOTS = TITLES · THICK BAR = MIDDLE 50% · DIAMOND = MEDIAN");
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickSize(-(height - margin.top - margin.bottom)).tickFormat(""));
    svg
      .append("line")
      .attr("x1", x(sampleMiddle))
      .attr("x2", x(sampleMiddle))
      .attr("y1", margin.top - 10)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "#b8a060")
      .attr("stroke-dasharray", "5 5")
      .attr("opacity", revealDuration ? 0 : 1)
      .transition()
      .duration(motionDuration(390))
      .attr("opacity", 1);
    svg
      .append("text")
      .attr("class", "zone-label")
      .attr("x", x(sampleMiddle) + 6)
      .attr("y", margin.top - 15)
      .text("ALL RATED FILMS · MEDIAN");

    const rows = svg
      .append("g")
      .selectAll("g")
      .data(ordered)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (_, band) => {
        selectedBand = band.key;
        render(state);
      });
    rows
      .append("rect")
      .attr("x", 10)
      .attr("y", (band) => y(band.key) - 7)
      .attr("height", y.bandwidth() + 14)
      .attr("width", width - 19)
      .attr("rx", 2)
      .attr("fill", (band) => band.key === selectedBand ? "rgba(212,168,48,0.07)" : "transparent")
      .attr("stroke", (band) => band.key === selectedBand ? "rgba(212,168,48,0.35)" : "transparent");
    rows
      .append("text")
      .attr("x", margin.left - 14)
      .attr("y", (band) => y(band.key) + y.bandwidth() / 2 - 7)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "end")
      .attr("fill", "var(--ink-soft)")
      .attr("font-family", "DM Mono, monospace")
      .attr("font-size", 11)
      .text((band) => `${band.label} / 5`);
    rows
      .append("text")
      .attr("class", "chart-label")
      .attr("x", margin.left - 14)
      .attr("y", (band) => y(band.key) + y.bandwidth() / 2 + 10)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "end")
      .text((band) => `n=${formatInteger(band.films.length)}`);
    const whiskers = rows
      .append("line")
      .attr("x1", (band) => revealDuration ? x(band.middle) : x(band.q10))
      .attr("x2", (band) => revealDuration ? x(band.middle) : x(Math.min(band.q90, upper)))
      .attr("y1", (band) => y(band.key) + y.bandwidth() / 2)
      .attr("y2", (band) => y(band.key) + y.bandwidth() / 2)
      .attr("stroke", "var(--line)")
      .attr("stroke-width", 1.1);
    const ranges = rows
      .append("line")
      .attr("x1", (band) => revealDuration ? x(band.middle) : x(band.q25))
      .attr("x2", (band) => revealDuration ? x(band.middle) : x(Math.min(band.q75, upper)))
      .attr("y1", (band) => y(band.key) + y.bandwidth() / 2)
      .attr("y2", (band) => y(band.key) + y.bandwidth() / 2)
      .attr("stroke", (band) => band.key === selectedBand ? "#c9843a" : "#8b6410")
      .attr("stroke-width", 12)
      .attr("stroke-linecap", "round")
      .attr("opacity", (band) => band.key === selectedBand ? 0.8 : 0.52);
    whiskers
      .transition()
      .delay((_, index) => revealDuration ? 70 + index * 44 : 0)
      .duration(revealDuration)
      .ease(d3.easeCubicOut)
      .attr("x1", (band) => x(band.q10))
      .attr("x2", (band) => x(Math.min(band.q90, upper)));
    ranges
      .transition()
      .delay((_, index) => revealDuration ? 100 + index * 44 : 0)
      .duration(revealDuration)
      .ease(d3.easeCubicOut)
      .attr("x1", (band) => x(band.q25))
      .attr("x2", (band) => x(Math.min(band.q75, upper)));

    ordered.forEach((band, bandIndex) => {
      const dots = svg
        .append("g")
        .selectAll("circle")
        .data(sampleFilms(band.films, metric.value), (movie) => movie.id)
        .join("circle")
        .attr("cx", (movie) => revealDuration ? x(band.middle) : x(Math.min(metric.value(movie), upper)))
        .attr("cy", (movie) => {
          const jitter = ((((movie.id * 2654435761) >>> 0) / 4294967295) - 0.5) * (y.bandwidth() - 10);
          return y(band.key) + y.bandwidth() / 2 + jitter;
        })
        .attr("r", revealDuration ? 0 : 2.4)
        .attr("fill", (movie) => COLORS[movie.genre])
        .attr("stroke", "var(--paper-2)")
        .attr("stroke-width", 0.6)
        .attr("opacity", revealDuration ? 0 : band.key === selectedBand ? 0.8 : 0.45)
        .style("cursor", "pointer")
        .on("mouseenter", (event, movie) => filmTooltip(event, movie))
        .on("mousemove", moveTooltip)
        .on("mouseleave", hideTooltip);
      dots
        .transition()
        .delay((_, index) => revealDuration ? 175 + bandIndex * 42 + (index % 10) * 8 : 0)
        .duration(revealDuration)
        .ease(d3.easeCubicOut)
        .attr("cx", (movie) => x(Math.min(metric.value(movie), upper)))
        .attr("r", 2.4)
        .attr("opacity", band.key === selectedBand ? 0.8 : 0.45);
    });

    const medians = rows
      .append("path")
      .attr("d", d3.symbol().type(d3.symbolDiamond).size(70))
      .attr("transform", (band) => `translate(${x(Math.min(band.middle, upper))},${y(band.key) + y.bandwidth() / 2}) scale(${revealDuration ? 0 : 1})`)
      .attr("fill", "#d4a830")
      .attr("stroke", "var(--paper-2)")
      .attr("stroke-width", 1.1);
    medians
      .transition()
      .delay((_, index) => revealDuration ? 300 + index * 44 : 0)
      .duration(motionDuration(420))
      .ease(d3.easeBackOut.overshoot(1.25))
      .attr("transform", (band) => `translate(${x(Math.min(band.middle, upper))},${y(band.key) + y.bandwidth() / 2}) scale(1)`);
    const medianText = rows
      .append("text")
      .attr("class", "chart-label")
      .attr("x", (band) => Math.min(x(Math.min(band.middle, upper)) + 10, width - margin.right - 30))
      .attr("y", (band) => y(band.key) + y.bandwidth() / 2 - 12)
      .attr("opacity", revealDuration ? 0 : 1)
      .text((band) => metric.format(band.middle));
    medianText
      .transition()
      .delay((_, index) => revealDuration ? 430 + index * 44 : 0)
      .duration(motionDuration(250))
      .attr("opacity", 1);
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickFormat(metric.format));
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", (margin.left + width - margin.right) / 2)
      .attr("y", height - 13)
      .attr("text-anchor", "middle")
      .text(`${metric.label} · LOG SCALE`);
  }

  return { render };
}
