VERSION = (2012, 9, 23, 2)


def get_version():
    return ".".join(map(str, VERSION))

__version__ = get_version()
