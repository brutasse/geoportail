VERSION = (2013, 11, 17, 6)


def get_version():
    return ".".join(map(str, VERSION))

__version__ = get_version()
