from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase

from trips.routing import UNAVAILABLE, Leg, RoutingError

CHICAGO = {"name": "Chicago, Illinois", "lat": 41.8756, "lng": -87.6244}
INDIANAPOLIS = {"name": "Indianapolis, Indiana", "lat": 39.7683, "lng": -86.1584}
DALLAS = {"name": "Dallas, Texas", "lat": 32.7763, "lng": -96.7969}
TRIP = {"current": CHICAGO, "pickup": INDIANAPOLIS, "dropoff": DALLAS, "cycle_used": 12.5, "start": "2026-10-04T06:00"}
LEGS = [
    Leg(183.2, 180, ((41.8756, -87.6244), (39.7683, -86.1584))),
    Leg(910.2, 900, ((39.7683, -86.1584), (32.7763, -96.7969))),
]


def fake_route(origin, destination):
    # Legs are routed in parallel, so answer by origin rather than call order.
    return LEGS[0] if origin == CHICAGO else LEGS[1]

EVENT_KEYS = {"kind", "status", "start", "end", "minutes", "miles", "lat", "lng", "place"}
LOG_KEYS = {"date", "from", "to", "miles", "segments", "totals", "remarks", "recap"}


class PlanApiTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def post(self, body):
        return self.client.post("/api/plan/", body, content_type="application/json")

    @patch("trips.views.route", side_effect=fake_route)
    def test_plan_matches_the_contract(self, route):
        response = self.post(TRIP)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(
            data["summary"],
            {
                "miles": 1093.4,
                "driving_minutes": 1080,
                "on_duty_minutes": 1290,
                "start": "2026-10-04T06:00",
                "end": "2026-10-05T13:30",
                "avg_mph": 60.7,
                "cycle_used_end": 34.0,
                "days": 2,
            },
        )
        self.assertEqual(
            data["legs"][0],
            {
                "from": "Chicago, Illinois",
                "to": "Indianapolis, Indiana",
                "miles": 183.2,
                "minutes": 180,
                "geometry": [[41.8756, -87.6244], [39.7683, -86.1584]],
            },
        )

        events = data["events"]
        self.assertEqual(
            events[0],
            {
                "kind": "pretrip",
                "status": "on",
                "start": "2026-10-04T06:00",
                "end": "2026-10-04T06:30",
                "minutes": 30,
                "miles": 0.0,
                "lat": 41.8756,
                "lng": -87.6244,
                "place": "Chicago, IL",
            },
        )
        self.assertTrue(all(set(event) == EVENT_KEYS for event in events))
        places = {event["kind"]: event["place"] for event in events}
        self.assertEqual((places["pickup"], places["dropoff"]), ("Indianapolis, IN", "Dallas, TX"))

        logs = data["logs"]
        self.assertTrue(all(set(day) == LOG_KEYS for day in logs))
        self.assertEqual(logs[0]["date"], "2026-10-04")
        self.assertEqual((logs[0]["from"], logs[-1]["to"]), ("Chicago, IL", "Dallas, TX"))
        self.assertEqual(logs[-1]["recap"]["last_7_days"], 34 * 60)

    def test_invalid_input_is_rejected(self):
        cases = {
            "cycle_used": {**TRIP, "cycle_used": 71},
            "start": {key: value for key, value in TRIP.items() if key != "start"},
            "pickup": {**TRIP, "pickup": {**INDIANAPOLIS, "lat": 91}},
        }
        for field, body in cases.items():
            with self.subTest(field=field):
                response = self.post(body)
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json())

    def test_routing_errors_keep_their_status(self):
        no_route = "No drivable route from Chicago, Illinois to Indianapolis, Indiana."
        for status, detail in [(502, UNAVAILABLE), (400, no_route)]:
            with self.subTest(status=status), patch("trips.views.route", side_effect=RoutingError(status, detail)):
                response = self.post(TRIP)
                self.assertEqual(response.status_code, status)
                self.assertEqual(response.json(), {"detail": detail})

    def test_throttles_after_30_requests_a_minute(self):
        statuses = [self.post({}).status_code for _ in range(31)]
        self.assertNotIn(429, statuses[:30])
        self.assertEqual(statuses[30], 429)
