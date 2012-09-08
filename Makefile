proj = geoportail
settings = --settings=$(proj).settings
test_settings = --settings=$(proj).test_settings

test:
	django-admin.py test $(test_settings) --failfast --noinput

run:
	foreman start

db:
	django-admin.py syncdb --noinput $(settings)

shell:
	django-admin.py shell $(settings)

dbshell:
	django-admin.py dbshell $(settings)
