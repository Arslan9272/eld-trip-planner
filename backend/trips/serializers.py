from rest_framework import serializers


class StopSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)


class TripSerializer(serializers.Serializer):
    current = StopSerializer()
    pickup = StopSerializer()
    dropoff = StopSerializer()
    cycle_used = serializers.FloatField(min_value=0, max_value=70)
    start = serializers.DateTimeField()

    def validate_start(self, value):
        if not 2000 <= value.year <= 2100:
            raise serializers.ValidationError("Start must be between the years 2000 and 2100.")
        return value
