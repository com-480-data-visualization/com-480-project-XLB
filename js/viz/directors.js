import {
  COLORS,
  d3,
  escapeHtml,
  filterMovies,
  formatInteger,
  formatMoney,
  formatPercent,
  formatRoi,
  hideTooltip,
  limitText,
  median,
  motionDuration,
  moveTooltip,
  setActiveButtons,
  showTooltip,
} from "../utils.js?v=20260526-final3";

function buildRecords(movies, minimumFilms) {
  return d3
    .groups(movies.filter((movie) => movie.director), (movie) => movie.director)
    .filter(([, films]) => films.length >= minimumFilms)
    .map(([name, films]) => {
      const sorted = films.slice().sort((first, second) => second.revenue - first.revenue);
      const genre = d3.greatest(
        d3.rollups(films, (entries) => entries.length, (movie) => movie.genre),
        (entry) => entry[1],
      )[0];
      return {
        name,
        films: sorted,
        filmCount: films.length,
        genre,
        totalRevenue: d3.sum(films, (movie) => movie.revenue),
        medianRoi: median(films.map((movie) => movie.roi)),
        hitShare: films.filter((movie) => movie.roi >= 2).length / films.length,
      };
    });
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

export function createDirectors(movies, precomputedDirectors, portraits = {}) {
  const container = document.getElementById("directors-viz");
  const detail = document.getElementById("director-detail");
  const count = document.getElementById("director-count");
  const reading = document.getElementById("director-reading");
  let minimumFilms = 6;
  let rankBy = "roi";
  let selectedName = null;
  let currentState = { genre: "All", decade: "all" };

  document.querySelectorAll("[data-director-min]").forEach((button) => {
    button.addEventListener("click", () => {
      minimumFilms = Number(button.dataset.directorMin);
      setActiveButtons("[data-director-min]", minimumFilms, "directorMin");
      render(currentState);
    });
  });
  document.querySelectorAll("[data-director-rank]").forEach((button) => {
    button.addEventListener("click", () => {
      rankBy = button.dataset.directorRank;
      setActiveButtons("[data-director-rank]", rankBy, "directorRank");
      render(currentState);
    });
  });

  function renderDetail(director) {
    if (!director) {
      detail.innerHTML = `
        <p class="section-label">DIRECTOR DOSSIER</p>
        <h3>No qualifying director</h3>
        <p class="muted">Widen the filters or lower the minimum release threshold.</p>
      `;
      return;
    }
    const maximum = director.films[0].revenue;
    const portrait = portraits[director.name];
    const portraitMarkup = portrait
      ? `
        <figure class="director-portrait">
          <img src="${escapeHtml(portrait.src)}" alt="Portrait of ${escapeHtml(director.name)}" loading="lazy">
          <figcaption><a href="${escapeHtml(portrait.sourceUrl)}" target="_blank" rel="noopener">PORTRAIT</a> · ${escapeHtml(portrait.license)}</figcaption>
        </figure>`
      : `
        <div class="director-portrait director-slate" aria-hidden="true">
          <span>${escapeHtml(initials(director.name))}</span>
          <small>PORTRAIT UNAVAILABLE</small>
        </div>`;
    detail.innerHTML = `
      <div class="director-card-head">
          ${portraitMarkup}
        <div>
          <p class="section-label">DIRECTOR DOSSIER</p>
          <h3>${escapeHtml(director.name)}</h3>
          <p class="muted">${formatInteger(director.filmCount)} financially valid films in view · dominant genre: ${escapeHtml(director.genre)}</p>
        </div>
      </div>
      <div class="metric-grid">
        <div><strong>${formatRoi(director.medianRoi)}</strong><span>MEDIAN ROI</span></div>
        <div><strong>${formatMoney(director.totalRevenue)}</strong><span>TOTAL GROSS</span></div>
        <div><strong>${formatPercent(director.hitShare)}</strong><span>HIT OR BETTER</span></div>
        <div><strong>${director.filmCount}</strong><span>FILMS OBSERVED</span></div>
      </div>
      <div class="portfolio-list">
        ${director.films.slice(0, 7).map((film) => `
          <div class="portfolio-film">
            <span title="${escapeHtml(film.title)}">${escapeHtml(limitText(film.title, 22))}</span>
            <i><b style="width:${(film.revenue / maximum) * 100}%"></b></i>
            <strong>${formatRoi(film.roi)}</strong>
          </div>`).join("")}
      </div>
    `;
    const portfolioDuration = motionDuration(470);
    d3.select(detail)
      .selectAll(".portfolio-film i b")
      .style("transform-origin", "left center")
      .style("transform", portfolioDuration ? "scaleX(0)" : "scaleX(1)")
      .transition()
      .delay((_, index) => portfolioDuration ? 100 + index * 45 : 0)
      .duration(portfolioDuration)
      .ease(d3.easeCubicOut)
      .style("transform", "scaleX(1)");
  }

  function render(state) {
    currentState = state;
    const records = state.genre === "All" && state.decade === "all"
      ? precomputedDirectors
          .filter((director) => director.filmCount >= minimumFilms)
          .map((director) => ({ ...director, hitShare: director.hitRate }))
      : buildRecords(filterMovies(movies, state), minimumFilms);
    const metric = rankBy === "gross"
      ? { value: (director) => director.totalRevenue, label: "TOTAL GROSS", format: formatMoney }
      : { value: (director) => director.medianRoi, label: "MEDIAN ROI", format: formatRoi };
    const ordered = records.slice().sort((first, second) => (
      d3.descending(metric.value(first), metric.value(second)) ||
      d3.ascending(first.name, second.name)
    ));
    const marquee = ordered.slice(0, 24);
    if (!marquee.some((director) => director.name === selectedName)) {
      selectedName = marquee[0]?.name || null;
    }
    const selected = records.find((director) => director.name === selectedName);
    const leader = marquee[0];
    count.textContent = `${formatInteger(records.length)} qualify · top ${formatInteger(marquee.length)} on marquee`;
    container.replaceChildren();

    if (!records.length) {
      reading.textContent = "No repeated directing record meets this threshold under the current filters; widen the cut or lower the evidence threshold.";
      d3.select(container).append("p").attr("class", "annotation").style("padding", "45px").text("No directors meet this threshold under the current filters.");
      renderDetail(null);
      return;
    }
    const roiLeader = d3.greatest(records, (director) => director.medianRoi);
    const grossLeader = d3.greatest(records, (director) => director.totalRevenue);
    reading.textContent = `A directing reputation changes meaning with the metric: among filmmakers with ${minimumFilms}+ eligible releases, ${roiLeader.name} leads sustained efficiency at ${formatRoi(roiLeader.medianRoi)}, while ${grossLeader.name} leads accumulated scale at ${formatMoney(grossLeader.totalRevenue)}. The marquee currently ranks by ${metric.label.toLowerCase()}, letting the same careers be judged as return generators or box-office institutions.`;

    const width = Math.max(container.clientWidth, 630);
    const rowHeight = 28;
    const height = 91 + marquee.length * rowHeight;
    const margin = { top: 50, right: 72, bottom: 38, left: 181 };
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(marquee, metric.value)])
      .nice()
      .range([margin.left, width - margin.right]);
    const y = d3
      .scaleBand()
      .domain(marquee.map((director) => director.name))
      .range([margin.top, height - margin.bottom])
      .padding(0.28);
    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("aria-label", "Ranked director repeated financial performance marquee");
    const revealDuration = motionDuration(540);

    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(4).tickSize(-(height - margin.top - margin.bottom)).tickFormat(""));
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${margin.top - 12})`)
      .call(d3.axisTop(x).ticks(4).tickFormat(metric.format).tickSizeOuter(0));
    svg
      .append("text")
      .attr("class", "chart-label")
      .attr("x", margin.left)
      .attr("y", 17)
      .text(`${metric.label} · CLICK A CREDIT LINE FOR THE PORTFOLIO`);

    const rows = svg
      .append("g")
      .selectAll("g")
      .data(marquee)
      .join("g")
      .attr("class", "director-row")
      .attr("opacity", revealDuration ? 0 : 1)
      .style("cursor", "pointer")
      .on("mouseenter", (event, director) => {
        showTooltip(event, director.name, [
          ["Films", formatInteger(director.filmCount)],
          ["Median ROI", formatRoi(director.medianRoi)],
          ["Total gross", formatMoney(director.totalRevenue)],
          ["Hit share", formatPercent(director.hitShare)],
        ]);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip)
      .on("click", (_, director) => {
        hideTooltip();
        selectedName = director.name;
        render(state);
      });
    rows
      .append("rect")
      .attr("x", 13)
      .attr("y", (director) => y(director.name) - 4)
      .attr("width", width - 25)
      .attr("height", y.bandwidth() + 8)
      .attr("rx", 2)
      .attr("fill", (director) => director.name === selectedName ? "rgba(212, 168, 48, 0.09)" : "transparent")
      .attr("stroke", (director) => director.name === selectedName ? "rgba(212, 168, 48, 0.38)" : "transparent");
    rows
      .append("text")
      .attr("class", "chart-label")
      .attr("x", 21)
      .attr("y", (director) => y(director.name) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .text((_, index) => String(index + 1).padStart(2, "0"));
    rows
      .append("text")
      .attr("x", margin.left - 13)
      .attr("y", (director) => y(director.name) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "end")
      .attr("fill", "var(--ink-soft)")
      .attr("font-family", "DM Mono, monospace")
      .attr("font-size", 10)
      .text((director) => limitText(director.name, 22));
    const bars = rows
      .append("rect")
      .attr("x", margin.left)
      .attr("y", (director) => y(director.name) + y.bandwidth() / 2 - 3)
      .attr("height", 6)
      .attr("width", (director) => revealDuration ? 0 : Math.max(1, x(metric.value(director)) - margin.left))
      .attr("fill", (director) => COLORS[director.genre] || COLORS.Other)
      .attr("opacity", (director) => director.name === selectedName ? 0.86 : 0.56);
    const caps = rows
      .append("circle")
      .attr("cx", (director) => revealDuration ? margin.left : x(metric.value(director)))
      .attr("cy", (director) => y(director.name) + y.bandwidth() / 2)
      .attr("r", (director) => director.name === selectedName ? 5 : 3.5)
      .attr("fill", (director) => COLORS[director.genre] || COLORS.Other)
      .attr("stroke", (director) => director.name === selectedName ? "#d4a830" : "var(--paper-2)")
      .attr("stroke-width", 1.2);
    const values = rows
      .append("text")
      .attr("class", "chart-label")
      .attr("x", (director) => x(metric.value(director)) + 9)
      .attr("y", (director) => y(director.name) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .attr("opacity", revealDuration ? 0 : 1)
      .text((director) => metric.format(metric.value(director)));
    rows
      .transition()
      .delay((_, index) => revealDuration ? index * 19 : 0)
      .duration(motionDuration(280))
      .attr("opacity", 1);
    bars
      .transition()
      .delay((_, index) => revealDuration ? 70 + index * 19 : 0)
      .duration(revealDuration)
      .ease(d3.easeCubicOut)
      .attr("width", (director) => Math.max(1, x(metric.value(director)) - margin.left));
    caps
      .transition()
      .delay((_, index) => revealDuration ? 70 + index * 19 : 0)
      .duration(revealDuration)
      .ease(d3.easeCubicOut)
      .attr("cx", (director) => x(metric.value(director)));
    values
      .transition()
      .delay((_, index) => revealDuration ? 350 + index * 19 : 0)
      .duration(motionDuration(260))
      .attr("opacity", 1);

    renderDetail(selected);
  }

  return { render };
}
