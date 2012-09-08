from django.conf.urls import patterns, url

from . import views


urlpatterns = patterns('',
    url(r'^autocomplete/$', views.autocomplete, name='autocomplete'),
)
