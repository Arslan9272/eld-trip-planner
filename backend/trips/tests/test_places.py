from unittest import TestCase

from trips.places import nearest


class PlacesTests(TestCase):
    def test_downtown_chicago(self):
        self.assertEqual(nearest(41.8756, -87.6244), "Chicago, IL")

    def test_rural_interstate_point_gets_the_nearest_town(self):
        # I-40 west of Amarillo, Texas.
        self.assertEqual(nearest(35.2, -102.9), "Vega, TX")

    def test_far_from_any_town_falls_back_to_coordinates(self):
        self.assertEqual(nearest(30.0, -40.0), "30.000, -40.000")
