VERSION = (2013, 11, 16, 2)


def get_version():
    return ".".join(map(str, VERSION))

__version__ = get_version()
