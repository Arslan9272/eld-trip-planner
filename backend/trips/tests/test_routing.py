import io
import json
from unittest import TestCase
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from trips.routing import RoutingError, decimate, fetch, point_at, route

A = {"name": "A", "lat": 41.0, "lng": -87.0}
B = {"name": "B", "lat": 41.5, "lng": -87.5}


def osrm_response(meters, seconds, coordinates):
    route = {"distance": meters, "duration": seconds, "geometry": {"coordinates": coordinates}}
    return io.BytesIO(json.dumps({"code": "Ok", "routes": [route]}).encode())


@patch.dict("os.environ", {"ORS_API_KEY": ""})
class RoutingTests(TestCase):
    def setUp(self):
        fetch.cache_clear()

    def test_nearby_points_make_a_zero_leg_without_a_request(self):
        with patch("trips.routing.urlopen") as urlopen:
            leg = route(A, {**A, "lat": 41.001})
        urlopen.assert_not_called()
        self.assertEqual(leg, (0.0, 0, ((41.0, -87.0),)))

    @patch("trips.routing.urlopen")
    def test_osrm_leg_in_miles_and_quarter_hours(self, urlopen):
        urlopen.return_value = osrm_response(16093.44, 1000, [[-87.0, 41.0], [-87.5, 41.5]])
        leg = route(A, B)
        self.assertAlmostEqual(leg.miles, 10.0)
        self.assertEqual(leg.minutes, 15)
        self.assertEqual(leg.points, ((41.0, -87.0), (41.5, -87.5)))

    @patch.dict("os.environ", {"ORS_API_KEY": "key"})
    @patch("trips.routing.urlopen")
    def test_ors_truck_route_when_a_key_is_set(self, urlopen):
        feature = {
            "properties": {"summary": {"distance": 32186.88, "duration": 1800}},
            "geometry": {"coordinates": [[-87.0, 41.0], [-87.5, 41.5]]},
        }
        urlopen.return_value = io.BytesIO(json.dumps({"features": [feature]}).encode())
        leg = route(A, B)
        self.assertEqual(urlopen.call_args.args[0].get_header("Authorization"), "key")
        self.assertAlmostEqual(leg.miles, 20.0)
        self.assertEqual(leg.minutes, 30)

    @patch.dict("os.environ", {"ORS_API_KEY": "key"})
    def test_ors_failure_falls_back_to_osrm(self):
        outage = HTTPError("url", 403, "Forbidden", {}, io.BytesIO())
        osrm = osrm_response(16093.44, 1000, [[-87.0, 41.0], [-87.5, 41.5]])
        with patch("trips.routing.urlopen", side_effect=[outage, osrm]) as urlopen:
            leg = route(A, B)
        self.assertEqual(urlopen.call_count, 2)
        self.assertEqual(leg.minutes, 15)

    def test_impossible_route_is_a_400(self):
        error = HTTPError("url", 400, "Bad Request", {}, io.BytesIO(b'{"code": "NoRoute"}'))
        with patch("trips.routing.urlopen", side_effect=error), self.assertRaises(RoutingError) as caught:
            route(A, B)
        self.assertEqual((caught.exception.status, caught.exception.detail), (400, "No drivable route from A to B."))

    def test_service_failure_is_a_502(self):
        for error in [URLError("timed out"), HTTPError("url", 503, "Unavailable", {}, io.BytesIO())]:
            with self.subTest(error=error), patch("trips.routing.urlopen", side_effect=error):
                with self.assertRaises(RoutingError) as caught:
                    route(A, B)
                self.assertEqual(caught.exception.status, 502)

    def test_decimate_keeps_both_ends(self):
        kept = decimate([[i, 0] for i in range(10_001)])
        self.assertLessEqual(len(kept), 1500)
        self.assertEqual((kept[0], kept[-1]), ([0, 0], [10_000, 0]))

    def test_point_at_interpolates_by_distance(self):
        lat, lng = point_at(((0.0, 0.0), (0.0, 1.0), (0.0, 3.0)), 0.5)
        self.assertAlmostEqual(lat, 0.0)
        self.assertAlmostEqual(lng, 1.5)
