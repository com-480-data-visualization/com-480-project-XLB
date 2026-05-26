import { loadData } from "./data-loader.js?v=20260526-final1";
import { getState, setState, subscribe } from "./state.js?v=20260526-final1";
import {
  DECADES,
  filterMovies,
  formatCorrelation,
  formatInteger,
  formatMoney,
  formatPercent,
  formatRoi,
  median,
} from "./utils.js?v=20260526-final1";
import { createDossierBoard } from "./viz/dossier-board.js?v=20260526-final1";
import { createFlow } from "./viz/flow.js?v=20260526-final1";
import { createProfitabilityMatrix } from "./viz/profitability-matrix.js?v=20260526-final1";
import { createDynasties } from "./viz/dynasties.js?v=20260526-final1";
import { createApplause } from "./viz/applause.js?v=20260526-final1";
import { createDirectors } from "./viz/directors.js?v=20260526-final1";

function text(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function populateStory(summary, movies) {
  const { counts, headline } = summary;
  const microFilms = movies.filter((movie) => movie.tier === "Micro");
  const blockbusterFilms = movies.filter((movie) => movie.tier === "Blockbuster");
  const recoveryShare = movies.filter((movie) => movie.roi >= 1).length / movies.length;
  const microMedian = median(microFilms.map((movie) => movie.roi));
  const blockbusterMedian = median(blockbusterFilms.map((movie) => movie.roi));
  text("stat-all-films", formatInteger(counts.processedRows));
  text("stat-financial", formatInteger(counts.financialMovies));
  text("stat-franchises", formatInteger(counts.franchises));
  text("stat-directors", formatInteger(counts.directorsWithSixFilms));
  text("prologue-n", formatInteger(counts.financialMovies));

  text(
    "final-summary",
    `Across ${formatInteger(counts.financialMovies)} cleaned financial records, ${formatPercent(recoveryShare)} recover their recorded production budget, yet the median micro-budget release returns ${formatRoi(microMedian)} against ${formatRoi(blockbusterMedian)} for blockbusters. ${headline.strongestGenre.genre} leads genre median return; audience ratings barely order logged gross revenue (${formatCorrelation(headline.ratingRevenueCorrelation)}); and only ${formatPercent(headline.sequelImprovementShare)} of measured sequels outgross the original that created their audience. Success has several forms, but no dependable shortcut.`,
  );
  text("take-scale-title", "Scale raises the ceiling.");
  text(
    "take-scale-copy",
    `A very large budget can reach exceptional grosses: ${headline.highestRevenue.title} reaches ${formatMoney(headline.highestRevenue.revenue)}. But micro-budget films post the stronger median return, separating reach from efficiency.`,
  );
  text("take-genre-title", "Fit matters more than formula.");
  text(
    "take-genre-copy",
    `${headline.strongestGenre.genre} leads displayed genres at ${formatRoi(headline.strongestGenre.medianRoi)} median return, with ${formatPercent(headline.strongestGenre.profitableShare)} recovering reported production budget. Genre changes the value of scale.`,
  );
  text("take-franchise-title", "Recognition is only an opening.");
  text(
    "take-franchise-copy",
    `Only ${formatPercent(headline.sequelImprovementShare)} of ${formatInteger(counts.sequelComparisons)} eligible sequel installments outgross their collection's original film.`,
  );
}

function bindSharedControls(movies) {
  const genreButtons = document.querySelectorAll("[data-genre]");
  const decadeSlider = document.getElementById("decade-slider");
  genreButtons.forEach((button) => {
    button.addEventListener("click", () => setState({ genre: button.dataset.genre }));
  });
  decadeSlider.addEventListener("input", () => {
    const selected = DECADES[Number(decadeSlider.value)];
    setState({ decade: selected.value });
  });

  return (state) => {
    genreButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.genre === state.genre);
    });
    const selectedIndex = DECADES.findIndex((decade) => decade.value === state.decade);
    decadeSlider.value = String(Math.max(0, selectedIndex));
    text("decade-label", DECADES[Math.max(0, selectedIndex)].label);
    text("active-count", `${formatInteger(filterMovies(movies, state).length)} films in view`);
  };
}

function setupChrome() {
  const progress = document.getElementById("progress");
  window.addEventListener("scroll", () => {
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = `${distance ? (window.scrollY / distance) * 100 : 0}%`;
  }, { passive: true });

  const showElement = (element) => {
    const firstReveal = !element.classList.contains("visible");
    element.classList.add("visible");
    if (firstReveal && element.classList.contains("viz-shell")) {
      element.dispatchEvent(new CustomEvent("cinescope:view-enter"));
    }
  };
  const revealObserver = new IntersectionObserver(
    (entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        showElement(entry.target);
        revealObserver.unobserve(entry.target);
      }
    }),
    { threshold: 0.08 },
  );
  document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

  const navigation = Array.from(document.querySelectorAll(".nav-links a"));
  const revealSection = (section) => {
    if (!section) {
      return;
    }
    section.querySelectorAll(".reveal").forEach(showElement);
  };
  const openHashSection = (shouldScroll = false) => {
    const section = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    if (!section) {
      return;
    }
    revealSection(section);
    if (shouldScroll) {
      const root = document.documentElement;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      section.scrollIntoView({ block: "start", behavior: "auto" });
      root.style.scrollBehavior = previousScrollBehavior;
    }
  };
  const sectionObserver = new IntersectionObserver(
    (entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        navigation.forEach((link) => {
          link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`);
        });
      }
    }),
    { rootMargin: "-30% 0px -58% 0px", threshold: 0 },
  );
  navigation.forEach((link) => {
    const section = document.querySelector(link.getAttribute("href"));
    if (section) {
      sectionObserver.observe(section);
    }
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (link) {
      revealSection(document.querySelector(link.getAttribute("href")));
    }
  });
  window.addEventListener("hashchange", () => openHashSection());

  const toggle = document.getElementById("theme-toggle");
  const setDarkRoom = (dark) => {
    document.body.classList.toggle("dark-room", dark);
    toggle.textContent = dark ? "LIGHT ROOM" : "DARK ROOM";
    toggle.setAttribute("aria-pressed", String(dark));
    window.localStorage.setItem("cinescope-theme", dark ? "dark" : "light");
  };
  setDarkRoom(window.localStorage.getItem("cinescope-theme") !== "light");
  toggle.addEventListener("click", () => {
    setDarkRoom(!document.body.classList.contains("dark-room"));
  });

  return openHashSection;
}

async function start() {
  const openHashSection = setupChrome();
  try {
    const data = await loadData();
    populateStory(data.summary, data.movies);
    const syncControls = bindSharedControls(data.movies);
    const scenes = [
      { id: "dossier", visualization: createDossierBoard(data.movies) },
      { id: "flow", visualization: createFlow(data.movies, (genre) => setState({ genre })) },
      { id: "matrix", visualization: createProfitabilityMatrix(data.movies) },
      { id: "dynasties", visualization: createDynasties(data.franchises) },
      { id: "applause", visualization: createApplause(data.movies) },
      { id: "directors", visualization: createDirectors(data.movies, data.directors, data.directorPortraits) },
    ];
    const visualizations = scenes.map((scene) => scene.visualization);
    const render = (state) => {
      syncControls(state);
      visualizations.forEach((visualization) => visualization.render(state));
    };
    subscribe(render);
    document.body.classList.add("preparing-charts");
    render(getState());
    document.body.classList.remove("preparing-charts");
    scenes.forEach(({ id, visualization }) => {
      const shell = document.querySelector(`#${id} .viz-shell`);
      shell?.addEventListener("cinescope:view-enter", () => visualization.render(getState()), { once: true });
      if (shell?.classList.contains("visible")) {
        visualization.render(getState());
      }
    });

    let timer = null;
    window.addEventListener("resize", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => render(getState()), 120);
    });
  } catch (error) {
    console.error(error);
    text("prologue-n", "unavailable");
    text("active-count", "Data could not be loaded");
  } finally {
    document.getElementById("loader").classList.add("loaded");
    document.body.classList.remove("is-loading");
    openHashSection(true);
  }
}

start();
