import math
import random
from datetime import datetime, timedelta
from itertools import pairwise
from unittest import TestCase

from trips.logs import build_logs
from trips.planner import Trip, plan
from trips.routing import Leg

START = datetime(2026, 10, 5, 6, 0)


def leg(miles, minutes):
    return Leg(miles, minutes, ())


def kinds(events):
    return [event.kind for event in events]


def driving(events):
    return sum(event.minutes for event in events if event.status == "driving")


class PlannerTests(TestCase):
    def test_short_trip_needs_no_rest(self):
        events = plan([leg(60, 60), leg(120, 120)], START, 0)
        self.assertEqual(kinds(events), ["pretrip", "drive", "pickup", "drive", "dropoff"])
        self.assertEqual([event.minutes for event in events], [30, 60, 60, 120, 60])
        [day] = build_logs(events, str)
        self.assertEqual(sum(day["totals"].values()), 1440)

    def test_start_rounds_up_to_the_quarter_hour(self):
        events = plan([leg(60, 60), leg(60, 60)], START.replace(minute=7, second=30), 0)
        self.assertEqual(events[0].start, START.replace(minute=15))
        self.assertEqual(plan([leg(60, 60), leg(60, 60)], START, 0)[0].start, START)

    def test_break_after_8_hours_of_driving(self):
        events = plan([leg(540, 540), leg(60, 60)], START, 0)
        self.assertEqual(kinds(events), ["pretrip", "drive", "break", "drive", "pickup", "drive", "dropoff"])
        self.assertEqual(events[1].minutes, 480)
        self.assertEqual((events[2].status, events[2].minutes), ("off", 30))

    def test_pickup_counts_as_the_break(self):
        events = plan([leg(300, 300), leg(300, 300)], START, 0)
        self.assertEqual(kinds(events), ["pretrip", "drive", "pickup", "drive", "dropoff"])

    def test_11_hour_limit_forces_a_10_hour_rest(self):
        events = plan([leg(810, 810), leg(60, 60)], START, 0)
        self.assertEqual(
            kinds(events),
            ["pretrip", "drive", "break", "drive", "rest", "pretrip", "drive", "pickup", "drive", "dropoff"],
        )
        self.assertEqual(driving(events[:4]), 660)
        self.assertEqual((events[4].status, events[4].minutes), ("sleeper", 600))

    def test_14_hour_window_binds_before_11_hours(self):
        # Planned stops leave at most 150 non-driving minutes in a shift, so in a planned trip
        # the 11-hour limit always comes first. A 5-hour load exercises the window directly.
        trip = Trip(START, 0)
        trip.add("pickup", "on", 300)
        trip.drive([leg(600, 600)], 600)
        self.assertEqual(kinds(trip.events), ["pickup", "pretrip", "drive", "break", "rest", "pretrip", "drive"])
        self.assertEqual(trip.events[4].start, START + timedelta(hours=14))
        self.assertEqual(driving(trip.events[:4]), 480)

    def test_fuel_at_least_every_1000_miles(self):
        events = plan([leg(100, 105), leg(2500, 2490)], START, 0)
        stops = [0.0] + [event.start_mile for event in events if event.kind == "fuel"] + [events[-1].end_mile]
        self.assertGreaterEqual(len(stops), 4)
        for before, after in pairwise(stops):
            self.assertLessEqual(after - before, 1000 + 1e-6)

    def test_restart_once_70_hours_are_used(self):
        events = plan([leg(120, 120), leg(600, 600)], START, 65)
        self.assertEqual(
            kinds(events),
            ["pretrip", "drive", "pickup", "drive", "restart", "pretrip", "drive", "break", "drive", "dropoff"],
        )
        worked = sum(event.minutes for event in events[:4])
        self.assertEqual(65 * 60 + worked, 70 * 60)
        assert_legal(self, events, [leg(120, 120), leg(600, 600)], 65)

    def test_restart_replaces_a_rest_when_no_hours_would_be_left(self):
        # The 11-hour limit lands with 15 minutes of the 70 hours left: too little for a pre-trip.
        events = plan([leg(900, 900), leg(60, 60)], START, 58.25)
        self.assertEqual(
            kinds(events),
            ["pretrip", "drive", "break", "drive", "restart", "pretrip", "drive", "pickup", "drive", "dropoff"],
        )

    def test_restart_instead_of_a_rest_when_it_delivers_sooner(self):
        # At 20 hours used, the cross-country leg used to rest 10 hours, drive 90 minutes and restart.
        legs = [leg(300, 300), leg(3000, 3000)]
        greedy = Trip(START, 20)
        greedy.compare_restarts = False
        greedy.finish(legs, legs[0].minutes)
        events = plan(legs, START, 20)
        self.assertLess(events[-1].end, greedy.events[-1].end)
        self.assertEqual(kinds(events).count("restart"), kinds(greedy.events).count("restart"))
        assert_legal(self, events, legs, 20)

    def test_restart_comes_before_the_first_pretrip_at_70_hours(self):
        events = plan([leg(60, 60), leg(60, 60)], START, 70)
        self.assertEqual(kinds(events)[:3], ["restart", "pretrip", "drive"])
        self.assertEqual((events[0].status, events[0].minutes), ("off", 2040))

    def test_zero_distance_first_leg(self):
        events = plan([leg(0, 0), leg(120, 120)], START, 0)
        self.assertEqual(kinds(events), ["pickup", "pretrip", "drive", "dropoff"])
        self.assertEqual(events[0].start, START)


class RandomTripTests(TestCase):
    def test_random_trips_follow_every_rule(self):
        rng = random.Random(395)
        for n in range(300):
            legs = [random_leg(rng), random_leg(rng)]
            start = datetime(2026, 10, 5) + timedelta(minutes=rng.randrange(1440))
            cycle_used = rng.randrange(281) / 4
            with self.subTest(n=n, legs=legs, start=start, cycle_used=cycle_used):
                events = plan(legs, start, cycle_used)
                assert_legal(self, events, legs, cycle_used)
                assert_valid_logs(self, events)


def random_leg(rng):
    miles = 0.0 if rng.random() < 0.1 else rng.uniform(0, 2500)
    minutes = 15 * round(miles / rng.uniform(40, 70) * 4)
    return leg(miles, max(minutes, 15) if miles > 0.1 else minutes)


def assert_legal(test, events, legs, cycle_used):
    test.assertEqual([kind for kind in kinds(events) if kind in ("pickup", "dropoff")], ["pickup", "dropoff"])
    test.assertEqual(events[-1].kind, "dropoff")
    test.assertEqual(driving(events), sum(leg.minutes for leg in legs))
    for before, after in pairwise(events):
        test.assertEqual(before.end, after.start)

    cycle = math.ceil(cycle_used * 4) * 15
    off_run = idle_run = shift_driving = since_break = 0
    since_fuel = 0.0
    window_start = None
    pretrip_done = False
    for event in events:
        test.assertGreater(event.minutes, 0)
        test.assertEqual(event.minutes % 15, 0)
        test.assertEqual(event.start.minute % 15, 0)
        if event.kind == "rest":
            test.assertGreaterEqual(event.minutes, 600)
        if event.kind == "restart":
            test.assertGreaterEqual(event.minutes, 2040)
        if event.kind == "pretrip":
            pretrip_done = True
        if event.kind == "fuel":
            since_fuel = 0.0

        if event.status in ("off", "sleeper"):
            off_run += event.minutes
            if off_run >= 600:
                shift_driving, window_start, pretrip_done = 0, None, False
            if off_run >= 2040:
                cycle = 0
        else:
            off_run = 0
            if window_start is None:
                window_start = event.start

        if event.status == "driving":
            test.assertTrue(pretrip_done)
            test.assertLessEqual(cycle + event.minutes, 4200)
            test.assertLessEqual(shift_driving + event.minutes, 660)
            test.assertLessEqual(event.end, window_start + timedelta(minutes=840))
            test.assertLessEqual(since_break + event.minutes, 480)
            test.assertLessEqual(since_fuel + event.miles, 1000 + 1e-6)
            shift_driving += event.minutes
            since_break += event.minutes
            since_fuel += event.miles
            idle_run = 0
        else:
            idle_run += event.minutes
            if idle_run >= 30:
                since_break = 0

        if event.status in ("driving", "on"):
            cycle += event.minutes


def assert_valid_logs(test, events):
    logs = build_logs(events, str)
    test.assertEqual(logs[0]["date"], events[0].start.date().isoformat())
    test.assertEqual(logs[-1]["date"], (events[-1].end - timedelta(minutes=1)).date().isoformat())
    for day in logs:
        segments = day["segments"]
        test.assertEqual((segments[0]["start"], segments[-1]["end"]), (0, 1440))
        for before, after in pairwise(segments):
            test.assertEqual(before["end"], after["start"])
            test.assertNotEqual(before["status"], after["status"])
        test.assertEqual(sum(day["totals"].values()), 1440)
    on_duty = sum(event.minutes for event in events if event.status in ("driving", "on"))
    test.assertEqual(sum(day["recap"]["on_duty_today"] for day in logs), on_duty)
