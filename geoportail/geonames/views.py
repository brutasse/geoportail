import unicodedata

from django.http import HttpResponse
from django.template.defaultfilters import slugify
from django.utils.translation import ugettext as _

from .models import Town


def autocomplete(request):
    if not 'q' in request.GET or len(request.GET['q']) < 3:
        response = HttpResponse()
        response.status_code = 204
        return response

    query = slugify(request.GET['q']).replace('-', ' ').upper()
    if query.startswith('ST '):
        query = 'SAINT ' + query[3:]

    towns = Town.objects.filter(
        tokenized__startswith=query
    ).order_by('tokenized', 'postal_code')[:15]
    content = u'\n'.join([u'{name} <em>{county_name}</em>|{lon} {lat}'.format(
        name=unicodedata.normalize('NFKD', t.name),
        county_name=t.county_name,
        lon=t.point.coords[0],
        lat=t.point.coords[1],
    ) for t in towns])
    if not content:
        content = _('No results. Search is limited to city names.')
    return HttpResponse(content)
