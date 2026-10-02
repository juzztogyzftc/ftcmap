# FTCMap

Interactive world map of FIRST Tech Challenge (FTC) teams. Search any team by
name or number, click a marker, and jump straight to the team's page on
FTCScout.

Built as a **100% static website** — no backend, no database, no paid APIs.
Works on GitHub Pages out of the box.

## Features

- Full-screen interactive world map (Leaflet + OpenStreetMap/CARTO tiles)
- Clustered markers — stays fast and readable with thousands of teams
- Case-insensitive search by **team number** and **team name**
  (`29393`, `juzztogyz`, `JUZZTOGYZ` all find the same team)
- Search dropdown with keyboard navigation (arrows / Enter / Esc)
- Selecting a result flies the map to the team and opens its card
- Team card: name, number, country, city, and an **Open on FTCScout** button
  (`https://ftcscout.org/teams/{teamNumber}`, opens in a new tab)
- "No teams found" state, clear-search button, responsive mobile layout
- Accessible: aria roles, focus states, keyboard-friendly

## Project structure

```
FTCMap/
├── index.html        — page markup
├── style.css         — styles (dark glass UI over the map)
├── app.js            — map, markers, clustering, search logic
├── teams.json        — team data (edit this to add teams)
├── README.md
└── assets/
    └── favicon.svg
```

## Team data

Teams live in `teams.json`:

```json
[
  {
    "teamNumber": "29393",
    "teamName": "JuzzTogyz",
    "country": "Kazakhstan",
    "city": "Karaganda",
    "lat": 49.806,
    "lng": 73.085
  }
]
```

The FTCScout link is generated automatically from `teamNumber` — no extra
field needed.

## Run locally

Because the site fetches `teams.json`, open it through a local server
(opening `index.html` directly via `file://` will be blocked by the browser):

```bash
# any one of these, from the project folder:
python3 -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000>.

## Tech

- [Leaflet](https://leafletjs.com/) — map
- [leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) — marker clustering
- [OpenStreetMap](https://www.openstreetmap.org/) data, basemap tiles (dark-muted theme)
- Vanilla JS/CSS — no build step
