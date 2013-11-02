proj = geoportail
settings = --settings=$(proj).default_settings
test_settings = --settings=$(proj).test_settings

test:
	python manage.py test --failfast --noinput

run:
	foreman start

makemessages:
	cd $(proj) && python ../manage.py makemessages -a

compilemessages:
	cd $(proj) && python ../manage.py compilemessages

txpush:
	tx push -s

txpull:
	tx pull -a
