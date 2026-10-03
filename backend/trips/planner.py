import copy
import math
from dataclasses import dataclass
from datetime import datetime, timedelta

# Durations are whole minutes in multiples of 15, like the grid on a paper log.
MAX_DRIVING = 660  # 395.3(a)(3)(i): 11 hours driving per shift
WINDOW = 840  # 395.3(a)(2): no driving after the 14th hour since coming on duty
BREAK_AFTER = 480  # 395.3(a)(3)(ii): 30-minute break once 8 hours have been driven
CYCLE_LIMIT = 4200  # 395.3(b)(2): 70 hours on duty in 8 days
FUEL_RANGE = 1000  # miles

PRETRIP = 30
PICKUP = 60
DROPOFF = 60
FUEL_STOP = 30
BREAK = 30
REST = 600  # 10 hours off restarts the 11- and 14-hour clocks
RESTART = 2040  # 34 hours off restarts the 70-hour clock

ON_DUTY = ("driving", "on")


@dataclass
class Event:
    kind: str
    status: str
    start: datetime
    end: datetime
    start_mile: float
    end_mile: float
    cycle: int  # on-duty minutes on the 70-hour clock when the event starts

    @property
    def minutes(self):
        return int((self.end - self.start).total_seconds()) // 60

    @property
    def miles(self):
        return self.end_mile - self.start_mile


def plan(legs, start, cycle_used_hours):
    trip = Trip(start, cycle_used_hours)
    trip.finish(legs, legs[0].minutes)
    return trip.events


def floor15(minutes):
    return int(minutes // 15) * 15


class Trip:
    def __init__(self, start, cycle_used_hours):
        # Round up: the driver can't go on duty before the time given.
        self.start = start.replace(second=0, microsecond=0) + timedelta(minutes=-start.minute % 15)
        self.t = 0  # minutes since trip start
        self.mile = 0.0
        # Quarter-hour grid; rounding up never under-counts hours already used.
        self.cycle = math.ceil(cycle_used_hours * 4) * 15
        self.driving_since_break = 0
        self.not_driving = 0
        self.miles_since_fuel = 0.0
        self.events = []
        self.compare_restarts = True
        self.new_shift()

    def new_shift(self):
        self.window_end = math.inf
        self.shift_driving = 0
        self.pretrip_due = True

    def finish(self, legs, left):
        # Drive the last `left` minutes of legs[0], then everything after it.
        self.drive(legs, left)
        if len(legs) > 1:
            self.add("pickup", "on", PICKUP)
            self.finish(legs[1:], legs[1].minutes)
        else:
            self.add("dropoff", "on", DROPOFF)

    def drive(self, legs, left):
        leg = legs[0]
        while left > 0:
            cycle_left = CYCLE_LIMIT - self.cycle
            shift_over = self.shift_driving >= MAX_DRIVING or self.t >= self.window_end
            fuel_chunk = floor15((FUEL_RANGE - self.miles_since_fuel) / leg.miles * leg.minutes)
            # Restart once the hours left can't cover the next pre-trip. A restart is also
            # longer than a 10-hour rest, so it replaces one that is due.
            if cycle_left - (PRETRIP if self.pretrip_due or shift_over else 0) <= 0:
                self.restart()
            elif shift_over:
                if self.restart_is_sooner(legs, left):
                    self.restart()
                else:
                    self.rest()
            elif self.pretrip_due:
                self.add("pretrip", "on", PRETRIP)
                self.pretrip_due = False
            elif fuel_chunk < 15:
                self.add("fuel", "on", FUEL_STOP)
                self.miles_since_fuel = 0.0
            elif self.driving_since_break >= BREAK_AFTER:
                self.add("break", "off", BREAK)
            else:
                minutes = min(
                    left,
                    BREAK_AFTER - self.driving_since_break,
                    MAX_DRIVING - self.shift_driving,
                    self.window_end - self.t,
                    cycle_left,
                    fuel_chunk,
                )
                self.add("drive", "driving", minutes, leg.miles * minutes / leg.minutes)
                left -= minutes

    def rest(self):
        self.add("rest", "sleeper", REST)
        self.new_shift()

    def restart(self):
        self.add("restart", "off", RESTART)
        self.cycle = 0
        self.new_shift()

    def restart_is_sooner(self, legs, left):
        # When the 70 hours can't cover another full shift, a 10-hour rest may only buy a short
        # drive before a 34-hour restart anyway. Plan the rest of the trip both ways and keep the
        # faster; on a tie the restart wins, as it skips that short shift.
        if not self.compare_restarts or CYCLE_LIMIT - self.cycle - PRETRIP >= MAX_DRIVING:
            return False
        resting, restarting = copy.deepcopy(self), copy.deepcopy(self)
        for trial in (resting, restarting):
            trial.compare_restarts = False
        resting.rest()
        restarting.restart()
        resting.finish(legs, left)
        restarting.finish(legs, left)
        return restarting.t <= resting.t

    def add(self, kind, status, minutes, miles=0.0):
        start = self.start + timedelta(minutes=self.t)
        end = start + timedelta(minutes=minutes)
        self.events.append(Event(kind, status, start, end, self.mile, self.mile + miles, self.cycle))
        if status in ON_DUTY:
            # The 14-hour window opens with the first on-duty minute of the shift.
            if self.window_end == math.inf:
                self.window_end = self.t + WINDOW
            self.cycle += minutes
        if status == "driving":
            self.not_driving = 0
            self.driving_since_break += minutes
            self.shift_driving += minutes
            self.miles_since_fuel += miles
        else:
            self.not_driving += minutes
            # 395.3(a)(3)(ii): any 30 consecutive non-driving minutes count, whatever the status.
            if self.not_driving >= BREAK:
                self.driving_since_break = 0
        self.t += minutes
        self.mile += miles
