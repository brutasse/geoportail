from django.contrib import admin

import floppyforms as forms

from .models import Town


class GmapPointWidget(forms.gis.BaseGMapWidget,
                      forms.gis.PointWidget):
    pass


class TownForm(forms.ModelForm):
    class Meta:
        model = Town
        widgets = {
            'point': GmapPointWidget,
        }


class TownAdmin(admin.ModelAdmin):
    form = TownForm
    search_fields = ['name']
    list_filter = ('state_name', 'county_name')
    list_display = ('name', 'get_postal_code', 'state_name', 'county_code',
                    'county_name')

admin.site.register(Town, TownAdmin)
