from django.conf import settings
from django.views import generic


class Home(generic.TemplateView):
    template_name = 'map/home.html'

    def get_context_data(self, **kwargs):
        ctx = super(Home, self).get_context_data(**kwargs)
        ctx['api_key'] = settings.GEOPORTAL_API_KEY
        return ctx
home = Home.as_view()
