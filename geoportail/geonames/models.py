# -*- coding: utf-8 -*-
from django.contrib.gis.db import models
from django.template.defaultfilters import slugify
from django.utils.translation import ugettext_lazy as _


class Town(models.Model):
    country_code = models.CharField(_('Country code'), max_length=2)
    postal_code = models.IntegerField(_('Postal code'), db_index=True)
    name = models.CharField(_('Name'), max_length=180)
    tokenized = models.CharField(_('Tokenized name'), max_length=180,
                                 db_index=True)

    # Region
    state_name = models.CharField(_('State'), max_length=100)
    state_code = models.CharField(_('State code'), max_length=10)

    # Departement
    county_name = models.CharField(_('County'), max_length=100)
    county_code = models.CharField(_('County code'), max_length=10)

    # Community
    community_name = models.CharField(_('Community'), max_length=100)
    community_code = models.CharField(_('Community code'), max_length=10,
                                      blank=True)

    point = models.PointField(_('Location'))
    # 1=estimated ... 6=centroid
    accuracy = models.IntegerField(_('Accuracy'))

    objects = models.GeoManager()

    def __unicode__(self):
        return u'{0}'.format(self.name)

    def get_postal_code(self):
        if self.country_code != 'FR':
            return self.postal_code
        pc = str(self.postal_code)
        if len(pc) == 4:
            return '0' + pc
        return pc
    get_postal_code.short_description = _('Postal code')
    get_postal_code.admin_order_field = 'postal_code'

    def tokenize(self):
        self.tokenized = slugify(self.name).replace('-', ' ').upper()
        self.save()

    class Meta:
        unique_together = ('postal_code', 'name')
        ordering = ('tokenized', 'postal_code')
        verbose_name = _('Town')
        verbose_name_plural = _('Towns')
