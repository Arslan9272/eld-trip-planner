# ELD Trip Planner

Plan a truck trip under FMCSA hours-of-service rules and get the driver's daily log sheets filled in.

Enter the current location, pickup, drop-off and the hours already used in the 70-hour cycle. The app routes the trip, schedules every inspection, break, fuel stop and rest the rules call for, shows them on a map, and draws one paper log sheet per day.

- Live app: https://eld-trip-planner-arslan.vercel.app
- Walkthrough video: _link_

## How a plan is built

Property-carrying driver on the 70-hour / 8-day cycle, no adverse driving conditions. Limits stop driving only; on-duty work after a limit is legal, as the FMCSA guide says.

| Rule | What the planner does |
| --- | --- |
| 11 hours of driving per shift | 10-hour sleeper-berth rest |
| No driving after the 14th hour since coming on duty | 10-hour sleeper-berth rest |
| 30-minute break after 8 hours of driving | Off-duty break, unless 30 consecutive non-driving minutes (pickup, fuel) already reset the clock |
| 70 hours on duty in 8 days | 34-hour restart. When the hours left can't cover another full shift, the rest of the trip is planned both ways (10-hour rest first, or restart now) and the faster plan is kept |
| Fuel at least every 1,000 miles | 30 minutes on duty, before the 1,000th mile |
| Pickup and drop-off | 1 hour on duty each |
| Pre-trip inspection | 30 minutes on duty at the start of each shift |

Assumptions:

- Times are home-terminal time: the clock of the start time entered, never shifted when the route crosses a time zone.
- Everything moves in quarter hours, like the paper grid. Each leg's drive time rounds to the nearest 15 minutes; the start time and the hours already used round up.
- The driver starts the trip rested. "Hours used" comes without day-by-day history, so those hours stay on the books for the whole trip and only a 34-hour restart frees them. The recap's 7-day and 8-day lines show that same total.
- Loading or unloading may carry the cycle past 70 hours after the last drive. That is legal (no driving happens past the limit), and the summary and sheet say so.
- Rests are full 10-hour sleeper-berth periods; split sleeper berth (7/3, 8/2) is not planned.
- Routes and drive times come from the public OSRM server. With `ORS_API_KEY` set, OpenRouteService takes over whenever OSRM is down or rate-limited. It is the backup rather than the default because its truck profile runs well under interstate speeds (Chicago to Indianapolis in 4 h 45 min, against about 3 h 30 min real-world).

## The log sheets

Each sheet copies the blank FMCSA driver's daily log: the duty-status line across the four rows, totals that add up to 24 hours, a remark at every change to a non-driving status (city and state, written at 45°), brackets under on-duty stops where the truck did not move, the day's miles and the 70-hour recap. The trip produces as many sheets as calendar days it touches.

Carrier, office and terminal addresses, truck and trailer numbers and shipping documents are blanks you click and fill in. They carry over to every sheet and are remembered in the browser.

**Save and start a new trip** (or **Print and save**, which prints one sheet per page first) files the trip in a saved-trips table and clears the planner for the next one. Saved trips stay in the browser and reopen with their map, schedule and sheets. Carrier and truck details carry into the next trip; the manifest and shipper clear, since they belong to the load.

## Layout

```
backend/                Django + Django REST Framework, no database
  trips/planner.py      hours-of-service engine: route legs in, duty events out
  trips/logs.py         splits the events into daily sheets
  trips/routing.py      OSRM / OpenRouteService, cached
  trips/places.py       nearest US town for remarks, offline
frontend/               React, TypeScript, Vite, Tailwind, Leaflet
  src/components/LogSheet.tsx   the paper log, drawn as SVG
```

`POST /api/plan/` takes `current`, `pickup` and `dropoff` (`name`, `lat`, `lng`), `cycle_used` (hours) and `start` (`YYYY-MM-DDTHH:MM`), and returns the summary, route legs, duty events and daily logs.

## Run locally

Backend:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py test
.venv/bin/python manage.py runserver 8000
```

Frontend, with `/api` proxied to port 8000:

```bash
cd frontend
npm install
npm run dev
```

## Deploy

One Vercel project with two services (`vercel.json`): `frontend/` builds as a static site, `backend/` runs Django as a Python function, and `/api/*` is routed to it. Environment variables: `DJANGO_SECRET_KEY` (required), `ORS_API_KEY` (optional, routing fallback).

## Data

Routes from OSRM or OpenRouteService. Map tiles and data © OpenStreetMap contributors. Place search by Photon. Town names from [GeoNames](https://www.geonames.org) cities1000 (CC BY 4.0), US populated places only.
