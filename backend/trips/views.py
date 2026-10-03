from concurrent.futures import ThreadPoolExecutor
from itertools import pairwise

from rest_framework.decorators import api_view
from rest_framework.response import Response

from .logs import build_logs, cycle_at
from .places import nearest
from .planner import ON_DUTY, plan
from .routing import RoutingError, position, route
from .serializers import TripSerializer


@api_view(["POST"])
def plan_trip(request):
    serializer = TripSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    trip = serializer.validated_data
    stops = [trip["current"], trip["pickup"], trip["dropoff"]]
    try:
        # Both legs at once: the public router is the slowest part of a request.
        with ThreadPoolExecutor(max_workers=2) as pool:
            legs = list(pool.map(lambda pair: route(*pair), pairwise(stops)))
    except RoutingError as error:
        return Response({"detail": error.detail}, status=error.status)

    events = plan(legs, trip["start"], trip["cycle_used"])
    logs = build_logs(events, lambda mile: nearest(*position(legs, mile)))
    return Response(
        {
            "summary": summarize(legs, events, logs),
            "legs": [leg_json(leg, a, b) for leg, (a, b) in zip(legs, pairwise(stops))],
            "events": [event_json(event, legs) for event in events],
            "logs": logs,
        }
    )


def summarize(legs, events, logs):
    miles = sum(leg.miles for leg in legs)
    driving = sum(event.minutes for event in events if event.status == "driving")
    return {
        "miles": round(miles, 1),
        "driving_minutes": driving,
        "on_duty_minutes": sum(event.minutes for event in events if event.status in ON_DUTY),
        "start": iso(events[0].start),
        "end": iso(events[-1].end),
        "avg_mph": round(miles / driving * 60, 1) if driving else 0.0,
        "cycle_used_end": cycle_at(events, events[-1].end) / 60,
        "days": len(logs),
    }


def leg_json(leg, origin, destination):
    return {
        "from": origin["name"],
        "to": destination["name"],
        "miles": round(leg.miles, 1),
        "minutes": leg.minutes,
        "geometry": leg.points,
    }


def event_json(event, legs):
    lat, lng = position(legs, event.start_mile)
    return {
        "kind": event.kind,
        "status": event.status,
        "start": iso(event.start),
        "end": iso(event.end),
        "minutes": event.minutes,
        "miles": round(event.miles, 1),
        "lat": round(lat, 5),
        "lng": round(lng, 5),
        "place": nearest(lat, lng),
    }


def iso(moment):
    return moment.isoformat(timespec="minutes")
