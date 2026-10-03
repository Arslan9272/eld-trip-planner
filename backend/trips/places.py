import csv
import math
from collections import defaultdict
from functools import cache
from pathlib import Path

PLACES_CSV = Path(__file__).parent / "data" / "us_places.csv"
MAX_DEGREES = 2.0


def nearest(lat, lng):
    grid = load_grid()
    scale = math.cos(math.radians(lat))
    row, col = math.floor(lat), math.floor(lng)
    best, best_distance = None, MAX_DEGREES
    for ring in range(4):
        for cell in ring_cells(row, col, ring):
            for place_lat, place_lng, name in grid.get(cell, ()):
                d = math.hypot(place_lat - lat, (place_lng - lng) * scale)
                if d < best_distance:
                    best, best_distance = name, d
        # Places in outer rings are at least `ring` cells away, so nothing out there is closer.
        if best and best_distance <= ring * scale:
            break
    return best or f"{lat:.3f}, {lng:.3f}"


def ring_cells(row, col, ring):
    for r in range(row - ring, row + ring + 1):
        for c in range(col - ring, col + ring + 1):
            if max(abs(r - row), abs(c - col)) == ring:
                yield r, c


@cache
def load_grid():
    grid = defaultdict(list)
    with PLACES_CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            lat, lng = float(row["lat"]), float(row["lng"])
            grid[math.floor(lat), math.floor(lng)].append((lat, lng, f"{row['name']}, {row['state']}"))
    return grid
