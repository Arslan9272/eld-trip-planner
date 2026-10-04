import json
import math
import os
from bisect import bisect_left
from functools import lru_cache
from itertools import accumulate, pairwise
from typing import NamedTuple
from urllib.error import HTTPError
from urllib.request import Request, urlopen

OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-hgv/geojson"
HEADERS = {"User-Agent": "eld-trip-planner/1.0"}
UNAVAILABLE = "Routing service is unavailable, try again shortly."
METERS_PER_MILE = 1609.344
EARTH_RADIUS_MILES = 3958.8
MAX_POINTS = 1500


class Leg(NamedTuple):
    miles: float
    minutes: int
    points: tuple  # ((lat, lng), ...)


class RoutingError(Exception):
    def __init__(self, status, detail):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def route(origin, destination):
    a = (origin["lat"], origin["lng"])
    b = (destination["lat"], destination["lng"])
    if miles_between(a, b) < 0.1:
        return Leg(0.0, 0, (a,))
    leg = fetch(rounded(a), rounded(b))
    if leg is None:
        raise RoutingError(400, f"No drivable route from {origin['name']} to {destination['name']}.")
    return leg


@lru_cache(maxsize=256)
def fetch(a, b):
    try:
        return fetch_osrm(a, b)
    except RoutingError:
        # The public OSRM server makes no uptime promise. OpenRouteService takes over when a key
        # is set; it stays the backup because its truck profile runs well under interstate speeds.
        if not os.environ.get("ORS_API_KEY"):
            raise
        return fetch_ors(a, b)


def fetch_ors(a, b):
    # radius -1: snap to the nearest road however far, as OSRM does
    body = {"coordinates": [[a[1], a[0]], [b[1], b[0]]], "radiuses": [-1, -1]}
    headers = {**HEADERS, "Authorization": os.environ["ORS_API_KEY"], "Content-Type": "application/json"}
    data = get_json(Request(ORS_URL, data=json.dumps(body).encode(), headers=headers))
    if data is None:
        return None
    feature = data["features"][0]
    summary = feature["properties"]["summary"]  # ORS leaves out zero values
    return make_leg(summary.get("distance", 0), summary.get("duration", 0), feature["geometry"]["coordinates"])


def fetch_osrm(a, b):
    url = f"{OSRM_URL}/{a[1]},{a[0]};{b[1]},{b[0]}?overview=full&geometries=geojson"
    data = get_json(Request(url, headers=HEADERS))
    if data is None:
        return None
    best = data["routes"][0]
    return make_leg(best["distance"], best["duration"], best["geometry"]["coordinates"])


def get_json(request):
    try:
        with urlopen(request, timeout=10) as response:
            return json.load(response)
    except HTTPError as error:
        # OSRM answers an impossible route with 400 {"code": "NoRoute"}.
        if error.code == 400:
            return None
        raise RoutingError(502, UNAVAILABLE) from error
    except (OSError, ValueError) as error:
        raise RoutingError(502, UNAVAILABLE) from error


def make_leg(meters, seconds, coordinates):
    miles = meters / METERS_PER_MILE
    minutes = 15 * round(seconds / 900)
    if miles > 0.1:
        minutes = max(minutes, 15)
    points = tuple((round(lat, 5), round(lng, 5)) for lng, lat in decimate(coordinates))
    return Leg(miles, minutes, points)


def decimate(points):
    step = max(1, math.ceil((len(points) - 1) / (MAX_POINTS - 1)))
    kept = points[::step]
    if (len(points) - 1) % step:
        kept.append(points[-1])
    return kept


def rounded(point):
    return round(point[0], 5), round(point[1], 5)


def miles_between(a, b):
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(h))


def position(legs, mile):
    for leg in legs:
        if mile <= leg.miles:
            return point_at(leg.points, mile / leg.miles if leg.miles else 0.0)
        mile -= leg.miles
    return legs[-1].points[-1]


def point_at(points, fraction):
    miles = cumulative_miles(points)
    target = fraction * miles[-1]
    i = bisect_left(miles, target)
    if i == 0:
        return points[0]
    if i == len(points):
        return points[-1]
    (lat1, lng1), (lat2, lng2) = points[i - 1], points[i]
    share = (target - miles[i - 1]) / (miles[i] - miles[i - 1])
    return lat1 + (lat2 - lat1) * share, lng1 + (lng2 - lng1) * share


@lru_cache(maxsize=16)
def cumulative_miles(points):
    return tuple(accumulate((miles_between(a, b) for a, b in pairwise(points)), initial=0.0))
