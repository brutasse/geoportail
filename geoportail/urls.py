from django.conf.urls import patterns, include, url

from django.contrib import admin
admin.autodiscover()


urlpatterns = patterns('',
    url(r'^$', include('geoportail.map.urls')),
    url(r'^geonames/', include('geoportail.geonames.urls')),
    url(r'^admin/', include(admin.site.urls)),
)
