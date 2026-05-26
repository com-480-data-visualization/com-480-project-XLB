export const d3 = window.d3;

export const GENRES = [
  "Action",
  "Drama",
  "Comedy",
  "Horror",
  "Animation",
  "Thriller",
  "Sci-Fi",
  "Other",
];

export const MATRIX_GENRES = [
  "Action",
  "Animation",
  "Comedy",
  "Drama",
  "Horror",
  "Sci-Fi",
  "Thriller",
];

export const DECADES = [
  { value: "all", label: "All decades" },
  { value: 1970, label: "1970s" },
  { value: 1980, label: "1980s" },
  { value: 1990, label: "1990s" },
  { value: 2000, label: "2000s" },
  { value: 2010, label: "2010s" },
];

export const TIERS = ["Micro", "Low", "Mid", "Blockbuster"];

export const TIER_LABELS = {
  Micro: "MICRO < $5M",
  Low: "LOW $5-20M",
  Mid: "MID $20-60M",
  Blockbuster: "BLOCK > $60M",
};

export const COLORS = {
  Action: "#c9843a",
  Drama: "#7a6fbd",
  Comedy: "#4a9e78",
  Horror: "#b54a3a",
  Animation: "#c9558a",
  Thriller: "#4a8ab5",
  "Sci-Fi": "#4aab9e",
  Other: "#8d806b",
};

const tooltip = document.getElementById("tooltip");
const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const wholeNumber = new Intl.NumberFormat("en-US");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

export function motionDuration(duration) {
  return reducedMotion.matches || document.body.classList.contains("preparing-charts") ? 0 : duration;
}

export function drawPaths(selection, duration = 760, delay = 0) {
  const activeDuration = motionDuration(duration);
  if (!activeDuration) {
    return selection;
  }
  selection.each(function drawPath(datum, index) {
    const path = d3.select(this);
    const length = this.getTotalLength();
    const wait = typeof delay === "function" ? delay(datum, index) : delay;
    path
      .attr("stroke-dasharray", `${length} ${length}`)
      .attr("stroke-dashoffset", length)
      .transition()
      .delay(wait)
      .duration(activeDuration)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0)
      .on("end", function clearDrawingMask() {
        d3.select(this).attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
      });
  });
  return selection;
}

export function matchesState(movie, state) {
  const genreMatch = state.genre === "All" || movie.genre === state.genre;
  const decadeMatch = state.decade === "all" || movie.decade === Number(state.decade);
  return genreMatch && decadeMatch;
}

export function filterMovies(movies, state) {
  return movies.filter((movie) => matchesState(movie, state));
}

export function dossierDisplaySample(movies, maximum = 800, spotlight = "") {
  if (movies.length <= maximum) {
    return { movies, sampled: false };
  }

  const selected = new Map();
  const add = (movie) => {
    if (movie) {
      selected.set(movie.id, movie);
    }
  };
  const searchTerm = spotlight.trim().toLowerCase();
  if (searchTerm) {
    movies
      .filter((movie) => movie.title.toLowerCase().includes(searchTerm))
      .slice(0, 12)
      .forEach(add);
  }

  d3.groups(movies, (movie) => movie.genre).forEach(([, films]) => {
    add(d3.greatest(films, (movie) => movie.revenue));
    add(d3.greatest(films, (movie) => movie.roi));
    add(d3.least(films, (movie) => movie.roi));
  });

  const strata = d3
    .groups(
      movies,
      (movie) =>
        `${movie.genre}|${movie.tier}|${movie.outcome}|${Math.max(1960, movie.decade)}`,
    )
    .map(([, films]) =>
      films.slice().sort(
        (first, second) =>
          d3.ascending(first.revenue, second.revenue) ||
          d3.ascending(first.title, second.title),
      ),
    )
    .sort((first, second) => d3.descending(first.length, second.length));

  strata.forEach((films) => {
    if (selected.size < maximum) {
      add(films[Math.floor(films.length / 2)]);
    }
  });
  const availableSeats = Math.max(0, maximum - selected.size);
  const quotas = strata.map((films) => ({
    films,
    quota: (availableSeats * films.length) / movies.length,
  }));
  quotas.forEach(({ films, quota }) => {
    const take = Math.min(films.length, Math.floor(quota));
    for (let index = 0; index < take && selected.size < maximum; index += 1) {
      const position = Math.floor(((index + 0.5) / take) * films.length);
      add(films[position]);
    }
  });
  const remaining = d3.merge(strata).sort((first, second) => {
    const hash = (movie) => (movie.id * 2654435761) >>> 0;
    return d3.ascending(hash(first), hash(second));
  });
  remaining.forEach((movie) => selected.size < maximum && add(movie));

  return { movies: Array.from(selected.values()).slice(0, maximum), sampled: true };
}

export function formatInteger(value) {
  return wholeNumber.format(value);
}

export function formatMoney(value) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1e9) {
    return `${sign}$${(absolute / 1e9).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}B`;
  }
  if (absolute >= 1e6) {
    return `${sign}$${(absolute / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  }
  return `${sign}$${compactNumber.format(absolute)}`;
}

export function formatRoi(value) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  if (value >= 100) {
    return `${Math.round(value).toLocaleString()}x`;
  }
  return `${value.toFixed(1)}x`;
}

export function formatPercent(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatCorrelation(value) {
  return value == null ? "-" : `r = ${value.toFixed(3)}`;
}

export function median(values) {
  return values.length ? d3.median(values) : null;
}

export function quantile(values, percentile) {
  return values.length ? d3.quantile(values.slice().sort(d3.ascending), percentile) : null;
}

export function limitText(value, maxLength = 28) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}...`;
}

export function clearElement(element) {
  while (element.firstChild) {
    element.firstChild.remove();
  }
}

export function chartWidth(element, fallback = 740) {
  return Math.max(element.clientWidth || fallback, 320);
}

export function setActiveButtons(selector, value, attribute) {
  document.querySelectorAll(selector).forEach((button) => {
    button.classList.toggle("active", button.dataset[attribute] === String(value));
  });
}

export function renderLegend(container, genres = GENRES) {
  container.innerHTML = genres
    .map(
      (genre) =>
        `<span class="legend-item"><i style="background:${COLORS[genre]}"></i>${genre}</span>`,
    )
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character]));
}

export function showTooltip(event, title, rows) {
  tooltip.innerHTML = `<h4>${escapeHtml(title)}</h4><dl>${rows
    .map(([label, value, className = ""]) => `<dt>${escapeHtml(label)}</dt><dd class="${className}">${escapeHtml(value)}</dd>`)
    .join("")}</dl>`;
  tooltip.classList.add("visible");
  moveTooltip(event);
}

export function moveTooltip(event) {
  const left = Math.min(event.clientX + 16, window.innerWidth - 285);
  const top = Math.max(event.clientY - 45, 12);
  tooltip.style.transform = `translate(${left}px, ${top}px)`;
}

export function hideTooltip() {
  tooltip.classList.remove("visible");
  tooltip.style.transform = "translate(-1000px, -1000px)";
}

export function filmTooltip(event, movie) {
  showTooltip(event, movie.title, [
    ["Year", String(movie.year)],
    ["Budget", formatMoney(movie.budget)],
    ["Revenue", formatMoney(movie.revenue)],
    ["ROI", formatRoi(movie.roi), movie.roi >= 1 ? "positive" : "negative"],
    ["Rating", movie.rating == null ? "-" : `${movie.rating.toFixed(2)} / 5`],
    ["Genre", movie.genre],
    ["Director", movie.director || "Unknown"],
    ["Cast", movie.cast?.join(", ") || "-"],
  ]);
}

export function regression(points) {
  if (points.length < 2) {
    return null;
  }
  const meanX = d3.mean(points, (point) => point.x);
  const meanY = d3.mean(points, (point) => point.y);
  const numerator = d3.sum(points, (point) => (point.x - meanX) * (point.y - meanY));
  const denominator = d3.sum(points, (point) => (point.x - meanX) ** 2);
  const slope = denominator ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;
  const correlationDenominator = Math.sqrt(
    d3.sum(points, (point) => (point.x - meanX) ** 2) *
      d3.sum(points, (point) => (point.y - meanY) ** 2),
  );
  const correlation = correlationDenominator
    ? numerator / correlationDenominator
    : 0;
  return { slope, intercept, correlation };
}
