from django.conf.urls import patterns, url

from . import views


urlpatterns = patterns('',
    url(r'^$', views.home, name='map_home'),
)
