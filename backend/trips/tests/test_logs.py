from datetime import datetime
from unittest import TestCase

from trips.logs import build_logs
from trips.planner import plan
from trips.routing import Leg


def place(mile):
    return f"mile {mile:.0f}"


def night_trip(cycle_used=10):
    # 20:00 start: pre-trip, then a 4-hour drive that runs past midnight.
    return plan([Leg(240, 240, ()), Leg(120, 120, ())], datetime(2026, 10, 5, 20, 0), cycle_used)


class LogTests(TestCase):
    def test_drive_across_midnight_is_split(self):
        day1, day2 = build_logs(night_trip(), place)
        self.assertEqual(day1["date"], "2026-10-05")
        self.assertEqual(
            day1["segments"],
            [
                {"status": "off", "start": 0, "end": 1200},
                {"status": "on", "start": 1200, "end": 1230},
                {"status": "driving", "start": 1230, "end": 1440},
            ],
        )
        self.assertEqual(day1["totals"], {"off": 1200, "sleeper": 0, "driving": 210, "on": 30})
        self.assertEqual((day1["from"], day1["to"], day1["miles"]), ("mile 0", "mile 210", 210.0))
        self.assertEqual(
            day2["segments"],
            [
                {"status": "driving", "start": 0, "end": 30},
                {"status": "on", "start": 30, "end": 90},
                {"status": "driving", "start": 90, "end": 210},
                {"status": "on", "start": 210, "end": 270},
                {"status": "off", "start": 270, "end": 1440},
            ],
        )
        self.assertEqual((day2["from"], day2["to"], day2["miles"]), ("mile 210", "mile 360", 150.0))

    def test_remarks_flag_each_stop_and_the_release(self):
        day1, day2 = build_logs(night_trip(), place)
        self.assertEqual(day1["remarks"], [{"minute": 1200, "place": "mile 0", "kind": "pretrip"}])
        self.assertEqual(
            day2["remarks"],
            [
                {"minute": 30, "place": "mile 240", "kind": "pickup"},
                {"minute": 210, "place": "mile 360", "kind": "dropoff"},
                {"minute": 270, "place": "mile 360", "kind": "off"},
            ],
        )

    def test_recap_carries_the_cycle(self):
        day1, day2 = build_logs(night_trip(cycle_used=10), place)
        self.assertEqual(
            day1["recap"], {"on_duty_today": 240, "last_7_days": 840, "available_tomorrow": 3360, "last_8_days": 840}
        )
        self.assertEqual(
            day2["recap"], {"on_duty_today": 270, "last_7_days": 1110, "available_tomorrow": 3090, "last_8_days": 1110}
        )

    def test_recap_counts_from_zero_after_a_restart(self):
        events = plan([Leg(60, 60, ()), Leg(60, 60, ())], datetime(2026, 10, 5, 6, 0), 70)
        day1, day2 = build_logs(events, place)
        self.assertEqual(day1["segments"], [{"status": "off", "start": 0, "end": 1440}])
        self.assertEqual((day1["recap"]["last_7_days"], day1["recap"]["available_tomorrow"]), (4200, 0))
        self.assertEqual(
            day2["recap"], {"on_duty_today": 270, "last_7_days": 270, "available_tomorrow": 3930, "last_8_days": 270}
        )

    def test_trip_ending_at_midnight_has_no_extra_day(self):
        events = plan([Leg(0, 0, ()), Leg(60, 60, ())], datetime(2026, 10, 5, 20, 30), 0)
        self.assertEqual(events[-1].end, datetime(2026, 10, 6))
        [day] = build_logs(events, place)
        self.assertEqual(day["segments"][-1], {"status": "on", "start": 1380, "end": 1440})
        self.assertEqual(day["remarks"][-1], {"minute": 1440, "place": "mile 60", "kind": "off"})
