import { loadData } from "./data-loader.js?v=20260526-final6";
import { getState, setState, subscribe } from "./state.js?v=20260526-final6";
import {
  DECADES,
  filterMovies,
  formatCorrelation,
  formatInteger,
  formatPercent,
  formatRoi,
  median,
} from "./utils.js?v=20260526-final6";
import { createDossierBoard } from "./viz/dossier-board.js?v=20260526-final6";
import { createFlow } from "./viz/flow.js?v=20260526-final6";
import { createProfitabilityMatrix } from "./viz/profitability-matrix.js?v=20260526-final6";
import { createDynasties } from "./viz/dynasties.js?v=20260526-final6";
import { createApplause } from "./viz/applause.js?v=20260526-final6";
import { createDirectors } from "./viz/directors.js?v=20260526-final6";

function text(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function populateStory(summary, movies, franchises) {
  const { counts, headline } = summary;
  const microFilms = movies.filter((movie) => movie.tier === "Micro");
  const blockbusterFilms = movies.filter((movie) => movie.tier === "Blockbuster");
  const microMedian = median(microFilms.map((movie) => movie.roi));
  const blockbusterMedian = median(blockbusterFilms.map((movie) => movie.roi));
  const sequelRoiImprovementShare = franchises.comparisons.filter(
    (comparison) => comparison.sequelRoi >= comparison.originalRoi,
  ).length / franchises.comparisons.length;
  text("stat-all-films", formatInteger(counts.processedRows));
  text("stat-financial", formatInteger(counts.financialMovies));
  text("stat-franchises", formatInteger(counts.franchises));
  text("stat-directors", formatInteger(counts.directorsWithSixFilms));
  text("prologue-n", formatInteger(counts.financialMovies));

  text(
    "final-summary",
    `The sharpest split is between applause and receipts: audience ratings barely order logged gross revenue (${formatCorrelation(headline.ratingRevenueCorrelation)}). Across ${formatInteger(counts.financialMovies)} financial records, micro-budget films return ${formatRoi(microMedian)} at the median against ${formatRoi(blockbusterMedian)} for blockbusters. Franchises expand attention without preserving efficiency: ${formatPercent(headline.sequelImprovementShare)} of measured sequels outgross their original, but only ${formatPercent(sequelRoiImprovementShare)} beat its ROI. Success has several forms, but no dependable shortcut.`,
  );
  text("take-scale-title", "Small bets multiply harder.");
  text(
    "take-scale-copy",
    `Micro-budget films return ${formatRoi(microMedian)} at the median versus ${formatRoi(blockbusterMedian)} for blockbusters. ${headline.strongestGenre.genre} leads genre median return at ${formatRoi(headline.strongestGenre.medianRoi)}; reach and efficiency are different victories.`,
  );
  text("take-genre-title", "Applause is not reach.");
  text(
    "take-genre-copy",
    `MovieLens audience rating and logged box-office gross are nearly unrelated in this eligible sample (${formatCorrelation(headline.ratingRevenueCorrelation)}). A film can be loved without becoming the largest commercial event.`,
  );
  text("take-franchise-title", "Scale is not sequel efficiency.");
  text(
    "take-franchise-copy",
    `Of ${formatInteger(counts.sequelComparisons)} eligible sequels, ${formatPercent(headline.sequelImprovementShare)} outgross their original, but just ${formatPercent(sequelRoiImprovementShare)} improve its ROI. Familiarity can finance expansion without preserving return.`,
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
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const setDarkRoom = (dark) => {
    document.body.classList.toggle("dark-room", dark);
    toggle.textContent = dark ? "LIGHT ROOM" : "DARK ROOM";
    toggle.setAttribute("aria-pressed", String(dark));
    themeColor?.setAttribute("content", dark ? "#100d09" : "#f5f0e6");
  };
  setDarkRoom(false);
  toggle.addEventListener("click", () => {
    setDarkRoom(!document.body.classList.contains("dark-room"));
  });

  return openHashSection;
}

async function start() {
  const openHashSection = setupChrome();
  try {
    const data = await loadData();
    populateStory(data.summary, data.movies, data.franchises);
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
