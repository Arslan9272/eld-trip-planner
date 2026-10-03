from django.urls import path

from trips.views import plan_trip

urlpatterns = [path("api/plan/", plan_trip)]
