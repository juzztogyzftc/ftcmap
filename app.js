/* ==========================================================================
   FTCMap — app.js
   Loads teams.json, renders clustered markers on a Leaflet map and
   provides fast case-insensitive search by team number and team name.
   ========================================================================== */

"use strict";

/* --------------------------------------------------------------------------
 * Config
 * ------------------------------------------------------------------------ */

const CONFIG = {
  teamsUrl: "teams.json",
  ftcscoutUrl: (teamNumber) => `https://ftcscout.org/teams/${encodeURIComponent(teamNumber)}`,
  initialView: { center: [30, 10], zoom: 2.5 },
  focusZoom: 10,
  maxSearchResults: 8,
  searchDebounceMs: 120,
  tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

/* --------------------------------------------------------------------------
 * Map setup
 * ------------------------------------------------------------------------ */

const map = L.map("map", {
  center: CONFIG.initialView.center,
  zoom: CONFIG.initialView.zoom,
  minZoom: 2,
  worldCopyJump: true,
  zoomControl: true,
});

L.tileLayer(CONFIG.tileUrl, {
  attribution: CONFIG.tileAttribution,
  maxZoom: 19,
}).addTo(map);

/* Clustered layer for team markers — keeps the map fast and readable
   even with thousands of teams. */
const clusterGroup = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 48,
  spiderfyOnMaxZoom: true,
});
map.addLayer(clusterGroup);

/* Keep a lookup from teamNumber -> marker so search can open popups. */
const markersByNumber = new Map();

/* --------------------------------------------------------------------------
 * Team data
 * ------------------------------------------------------------------------ */

let teams = []; // raw teams from teams.json

const teamCountEl = document.getElementById("team-count");

function createMarker(team) {
  const icon = L.divIcon({
    className: "team-marker",
    html: '<span class="dot"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  const marker = L.marker([team.lat, team.lng], {
    icon,
    title: `${team.teamName} #${team.teamNumber}`,
    keyboard: true,
    alt: `FTC team ${team.teamName} number ${team.teamNumber}`,
  });

  marker.bindPopup(buildPopupHtml(team), {
    closeButton: true,
    autoPanPadding: L.point(30, 80),
    maxWidth: 320,
  });

  return marker;
}

function buildPopupHtml(team) {
  const location = [team.city, team.country].filter(Boolean).join(", ");
  const url = CONFIG.ftcscoutUrl(team.teamNumber);
  return `
    <div class="team-card">
      <h2 class="tc-name">${escapeHtml(team.teamName)}</h2>
      <div class="tc-number">#${escapeHtml(team.teamNumber)}</div>
      <div class="tc-location">${escapeHtml(location)}</div>
      <a class="tc-link" href="${url}" target="_blank" rel="noopener noreferrer">
        Open on FTCScout
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
          <path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor"
                stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
    </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

async function loadTeams() {
  try {
    const res = await fetch(CONFIG.teamsUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    teams = await res.json();
  } catch (err) {
    console.error("Failed to load teams.json:", err);
    teamCountEl.textContent = "Failed to load teams";
    return;
  }

  const markers = [];
  for (const team of teams) {
    if (typeof team.lat !== "number" || typeof team.lng !== "number") continue;
    const marker = createMarker(team);
    markers.push(marker);
    markersByNumber.set(String(team.teamNumber), marker);
  }
  clusterGroup.addLayers(markers); // batched: one DOM update for all markers
  teamCountEl.textContent = `${markers.length.toLocaleString()} teams`;
}

/* --------------------------------------------------------------------------
 * Search
 * ------------------------------------------------------------------------ */

const searchBox = document.querySelector(".search");
const searchInput = document.getElementById("search-input");
const searchClear = document.getElementById("search-clear");
const resultsEl = document.getElementById("search-results");
const emptyEl = document.getElementById("search-empty");

let activeIndex = -1; // keyboard-highlighted result
let currentResults = [];

/* Case-insensitive substring match on team number + team name.
   Simple and fast even for tens of thousands of teams. */
function searchTeams(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (const team of teams) {
    if (
      String(team.teamNumber).toLowerCase().includes(q) ||
      String(team.teamName).toLowerCase().includes(q)
    ) {
      out.push(team);
      if (out.length >= CONFIG.maxSearchResults) break;
    }
  }
  return out;
}

function renderResults(results) {
  currentResults = results;
  activeIndex = -1;
  resultsEl.innerHTML = "";

  if (results.length === 0) {
    resultsEl.hidden = true;
    emptyEl.hidden = false;
    searchBox.setAttribute("aria-expanded", "true");
    return;
  }

  emptyEl.hidden = true;
  resultsEl.hidden = false;
  searchBox.setAttribute("aria-expanded", "true");

  const frag = document.createDocumentFragment();
  results.forEach((team, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-result";
    btn.id = `search-result-${i}`;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", "false");
    btn.innerHTML =
      `<span class="r-name">${escapeHtml(team.teamName)}</span>` +
      `<span class="r-meta">#${escapeHtml(team.teamNumber)} · ${escapeHtml(team.country)}</span>`;
    btn.addEventListener("click", () => selectTeam(team));
    frag.appendChild(btn);
  });
  resultsEl.appendChild(frag);
}

function hideResults() {
  resultsEl.hidden = true;
  emptyEl.hidden = true;
  searchBox.setAttribute("aria-expanded", "false");
  searchInput.removeAttribute("aria-activedescendant");
  activeIndex = -1;
}

/* Fly the map to the team and open its popup. */
function selectTeam(team) {
  hideResults();
  searchInput.value = `${team.teamName} #${team.teamNumber}`;
  searchClear.hidden = false;

  const marker = markersByNumber.get(String(team.teamNumber));
  if (!marker) return;

  map.flyTo([team.lat, team.lng], CONFIG.focusZoom, { duration: 0.9 });
  map.once("moveend", () => {
    // Marker may be inside a cluster — spiderfy/unspider as needed.
    clusterGroup.zoomToShowLayer(marker, () => marker.openPopup());
  });
}

/* Debounced input handler */
let debounceTimer = null;
searchInput.addEventListener("input", () => {
  const q = searchInput.value;
  searchClear.hidden = q.length === 0;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (!q.trim()) {
      hideResults();
      return;
    }
    renderResults(searchTeams(q));
  }, CONFIG.searchDebounceMs);
});

/* Keyboard navigation: ArrowUp / ArrowDown / Enter / Escape */
searchInput.addEventListener("keydown", (e) => {
  if (resultsEl.hidden) return;

  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const dir = e.key === "ArrowDown" ? 1 : -1;
    activeIndex = (activeIndex + dir + currentResults.length) % currentResults.length;
    updateActiveResult();
  } else if (e.key === "Enter") {
    if (activeIndex >= 0 && currentResults[activeIndex]) {
      e.preventDefault();
      selectTeam(currentResults[activeIndex]);
    } else if (currentResults.length > 0) {
      e.preventDefault();
      selectTeam(currentResults[0]);
    }
  } else if (e.key === "Escape") {
    hideResults();
  }
});

function updateActiveResult() {
  const items = resultsEl.querySelectorAll(".search-result");
  items.forEach((el, i) => {
    const isActive = i === activeIndex;
    el.classList.toggle("active", isActive);
    el.setAttribute("aria-selected", String(isActive));
  });
  if (activeIndex >= 0) {
    searchInput.setAttribute("aria-activedescendant", `search-result-${activeIndex}`);
    items[activeIndex].scrollIntoView({ block: "nearest" });
  }
}

/* Clear button */
searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.hidden = true;
  hideResults();
  searchInput.focus();
});

/* Close dropdown when clicking outside */
document.addEventListener("click", (e) => {
  if (!searchBox.contains(e.target)) hideResults();
});

/* --------------------------------------------------------------------------
 * Init
 * ------------------------------------------------------------------------ */

loadTeams();
