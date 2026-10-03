import math
from datetime import datetime, time, timedelta
from itertools import pairwise

from .planner import CYCLE_LIMIT, ON_DUTY

STATUSES = ("off", "sleeper", "driving", "on")


def build_logs(events, place_at):
    trip_start, trip_end = events[0].start, events[-1].end
    first = datetime.combine(trip_start.date(), time())
    # A trip that ends exactly at midnight gets no extra, empty day.
    last = datetime.combine((trip_end - timedelta(minutes=1)).date(), time()) + timedelta(days=1)
    # Off duty from the first midnight until the trip starts, and after release until the last midnight.
    spans = [
        ("off", first, trip_start),
        *((event.status, event.start, event.end) for event in events),
        ("off", trip_end, last),
    ]
    logs = []
    midnight = first
    while midnight < last:
        logs.append(day_log(events, spans, midnight, place_at))
        midnight += timedelta(days=1)
    return logs


def day_log(events, spans, midnight, place_at):
    day_end = midnight + timedelta(days=1)

    segments = []
    for status, start, end in spans:
        start, end = max(start, midnight), min(end, day_end)
        if start >= end:
            continue
        if segments and segments[-1]["status"] == status:
            segments[-1]["end"] = minutes(end - midnight)
        else:
            segments.append({"status": status, "start": minutes(start - midnight), "end": minutes(end - midnight)})

    totals = dict.fromkeys(STATUSES, 0)
    for segment in segments:
        totals[segment["status"]] += segment["end"] - segment["start"]

    remarks = [
        {"minute": minutes(event.start - midnight), "place": place_at(event.start_mile), "kind": event.kind}
        for event in events
        if event.status != "driving" and midnight <= event.start < day_end
    ]
    # A stop carried over from the previous sheet still needs a place where the truck moves off.
    for stop, drive in pairwise(events):
        if stop.status != "driving" and stop.start < midnight < stop.end <= day_end and drive.status == "driving":
            remarks.insert(0, {"minute": minutes(stop.end - midnight), "place": place_at(drive.start_mile), "kind": "drive"})
    release = events[-1].end
    if midnight < release <= day_end:
        remarks.append({"minute": minutes(release - midnight), "place": place_at(events[-1].end_mile), "kind": "off"})

    start_mile, end_mile = mile_at(events, midnight), mile_at(events, day_end)
    cycle = cycle_at(events, day_end)
    return {
        "date": midnight.date().isoformat(),
        "from": place_at(start_mile),
        "to": place_at(end_mile),
        # Whole miles from rounded odometer readings, so the days add up to the trip.
        "miles": whole(end_mile) - whole(start_mile),
        "segments": segments,
        "totals": totals,
        "remarks": remarks,
        # Flat cycle: nothing rolls off during the trip, so 7- and 8-day totals are the cycle total.
        "recap": {
            "on_duty_today": totals["driving"] + totals["on"],
            "last_7_days": cycle,
            "available_tomorrow": max(0, CYCLE_LIMIT - cycle),
            "last_8_days": cycle,
        },
    }


def mile_at(events, moment):
    event, elapsed = in_progress(events, moment)
    return event.start_mile + event.miles * (elapsed / (event.end - event.start))


def cycle_at(events, moment):
    event, elapsed = in_progress(events, moment)
    return event.cycle + (minutes(elapsed) if event.status in ON_DUTY else 0)


def in_progress(events, moment):
    for event in events:
        if moment < event.end:
            return event, max(moment - event.start, timedelta(0))
    return events[-1], events[-1].end - events[-1].start


def whole(mile):
    return math.floor(mile + 0.5)


def minutes(delta):
    return int(delta.total_seconds()) // 60
