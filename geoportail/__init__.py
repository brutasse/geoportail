VERSION = (2012, 9, 1, 1)


def get_version():
    return ".".join(map(str, VERSION))

__version__ = get_version()
