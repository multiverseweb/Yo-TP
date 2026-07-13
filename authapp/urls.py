from django.urls import path
from . import views

urlpatterns = [
    path('', views.landing_page, name='landing'),
    path('api/send-otp/', views.send_otp, name='send_otp'),
    path('api/verify-otp/', views.verify_otp, name='verify_otp'),
    path('api/stats/', views.get_stats, name='get_stats'),
]
