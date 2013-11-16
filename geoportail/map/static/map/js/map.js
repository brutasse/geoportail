var app = angular.module('geoportail', []);

app.config(['$locationProvider', function(locationProvider) {
    locationProvider.html5Mode(true);
}]);

app.factory('capabilities', ['$http', '$q', function(http, q) {
    var done = {};
    var fetched = {};
    var resolved = {}

    var capabilities = function(url) {
        if (fetched[url]) {
            return done[url].promise;
        }
        done[url] = q.defer();
        var promise = http.get(url);
        promise.then(function(data) {
            fetched[url] = true;
            resolved[url] = data;
            done[url].resolve(data);
        });
        return promise;
    };

    return {
        get: capabilities
    };
}]);

app.factory('map', ['capabilities', 'gplocation', '$timeout', function(capabilities, location, timeout) {
    Proj4js.defs['IGNF:WGS84G'] = '+title=World Geodetic System 1984 ' +
        '+proj=longlat +towgs84=0.0000,0.0000,0.0000,0.0000,0.0000,0.0000,' +
        '0.000000 +a=6378137.0000 +rf=298.2572221010000 +units=m +no_defs <>';

    var attribution = new ol.Attribution({
        html: '<a href="http://www.geoportail.fr/" target="_blank">' +
            '<img src="http://api.ign.fr/geoportail/api/js/latest/' +
            'theme/geoportal/img/logo_gp.gif"></a>'
    });

    var layers = [
        {
            id: "maps",
            code: "GEOGRAPHICALGRIDSYSTEMS.MAPS",
            logo: "http://gpp3-wxs.ign.fr/static/logos/IGN/IGN.gif"
        }, {
            id: "satellite",
            code: "ORTHOIMAGERY.ORTHOPHOTOS",
            logo: "http://gpp3-wxs.ign.fr/static/logos/PLANETOBSERVER/PLANETOBSERVER.gif"
        }, {
            id: "cadastre",
            code: "CADASTRALPARCELS.PARCELS",
            logo: "http://gpp3-wxs.ign.fr/static/logos/IGN/IGN.gif"
        }
    ];

    var mercator = 'EPSG:3857';
    var wgs84 = 'EPSG:4326';

    var view;
    var map;
    var layer;
    var attrs;
    var caps;
    var current_layer;

    /**
     * Returns a config object according to what's in the URL.
     *
     * @param {boolean} include_info set this to False to avoid getting the
     * 'layerinfo' key in the returned object.
     */
    var get_map_config = function(include_info) {
        if (include_info === undefined) {
            include_info = true;
        }
        // center of France
        // http://toolserver.org/~geohack/geohack.php?pagename=Centre_de_la_France&language=fr&params=46_36_22_N_01_52_31_E_
        var config = {
            layer: "maps",
            zoom: 6,
            lon: 1.875278,
            lat: 46.606111
        }
        _.extend(config, location.search());
        config.lon = parseFloat(config.lon);
        config.lat = parseFloat(config.lat);
        config.zoom = parseInt(config.zoom);
        if (include_info) {
            config.layerinfo = _.chain(layers)
                .filter(function(layer) { return layer.id === config.layer; })
                .first()
                .value();
        }
        return config;
    };

    /**
     * Constructs a layer from a config object.
     *
     * @param {Object} config an element of the 'layers' array above.
     * @returns {ol.layer} a layer object.
     */
    var get_layer = function(config) {
        var options = ol.source.WMTS.optionsFromCapabilities(caps, config.code);
        options.urls = ['http://wxs.ign.fr/' + attrs.gpKey + '/geoportail/wmts'];
        options.attributions = [attribution];
        options.logo = config.logo;
        var source = new ol.source.WMTS(options);
        return new ol.layer.Tile({source: source});
    };

    /**
     * Get the view's center in WGS84 projection, rounded to the precision
     * that's good enough for proper behaviour without polluting the URLs.
     * @returns {Object} the center of view.
     */
    var get_center = function() {
        var center = ol.proj.transform(view.getCenter(), mercator, wgs84)
        return {
            lon: center[0].toFixed(6),
            lat: center[1].toFixed(6)
        };
    };

    var init = function(params, scope) {
        scope.$on('$locationChangeSuccess', focus);
        attrs = params;

        capabilities.get(attrs.gpCapabilities).then(function(data) {
            var parser = new ol.parser.ogc.WMTSCapabilities();
            caps = parser.read(data.data);

            var config = get_map_config();
            layer = get_layer(config.layerinfo);
            current_layer = config.layer;

            view = new ol.View2D({
                center: ol.proj.transform([config.lon, config.lat], wgs84, mercator),
                zoom: config.zoom
            });

            var tm;

            view.on('change:center', function() {
                if (tm) {
                    timeout.cancel(tm);
                }
                tm = timeout(function() {
                    var config = get_map_config(false);
                    _.extend(config, get_center())
                    location.update(config);
                }, 1000);
            });

            view.on('change:resolution', function() {
                timeout(function() {
                    var center = get_center();
                    center.zoom = view.getZoom();
                    location.update(center);
                });
            });

            map = new ol.Map({
                renderer: ol.RendererHint.CANVAS,
                target: attrs.id,
                layers: [layer],
                view: view
            });
        });
    };

    /**
     * Updates the current layer.
     *
     * @param {string} code the code of the new layer.
     */
    var set_layer = function(code) {
        if (code === current_layer) return;
        map.removeLayer(layer);
        location.update({layer: code});
        layer = get_layer(get_map_config().layerinfo);
        map.addLayer(layer);
        current_layer = code;
    };

    /**
     * push/popState handler
     */
    var focus = function() {
        if (!view) return;
        config = get_map_config();
        set_layer(config.layer);
        view.setCenter(ol.proj.transform([config.lon, config.lat], wgs84, mercator));
        view.setZoom(config.zoom || 13);
    };

    return {
        init: init
    };
}]);

app.directive('gpMap', ['map', function(map) {
    return function(scope, element, attrs) {
        map.init(attrs, scope);
    };
}]);

app.factory('gplocation', ['$location', function(location) {
    var update = function(data) {
        var search = location.search();
        _.extend(search, data);
        location.search(search);
    };
    var search = function(data) {
        if (data) {
            return location.search(data);
        } else {
            return location.search();
        }
    };
    return {update: update, search: search};
}]);

app.directive('gpSwitch', ['$timeout', 'gplocation', function(timeout, location) {
    return {
        link: function(scope, element, attrs) {
            var layer = location.search().layer || "maps";
            element.toggleClass('selected', attrs.id === layer);

            element.bind('click', function() {
                _.each(document.querySelectorAll('[gp-switch]'), function(el) {
                    el = angular.element(el);
                    el.toggleClass('selected', el.attr('id') === attrs.id);
                });
                timeout(function() {
                    location.update({layer: attrs.id});
                });
            });
        }
    };
}]);

app.directive('focusOn', function() {
    return {
        scope: {},
        link: function(scope, element, attrs) {
            scope.$parent.$watch(attrs.focusOn, function(newValue) {
                if (newValue) {
                    element[0].focus();
                }
            });
        }
    };
});

app.directive('gpResize', ['$window', '$timeout', function(_window, timeout) {
    var window = angular.element(_window);
    return {
        scope: {},
        link: function(scope, element, attrs) {
            var menu = element.find('span')[0].offsetWidth;
            var input = element.find('input')[0].offsetWidth;
            var limit = menu + input + 14; // 10 padding + space
            var onres = function() {
                timeout(function() {
                    scope.$parent.toggle = _window.innerWidth < limit;
                });
            };
            window.bind('resize', onres);
            onres();
            scope.$parent.expand = function() {
                scope.$parent.expanded = true;
            };
            scope.$parent.collapse = function() {
                scope.$parent.expanded = false;
            };
        }
    };
}]);

app.directive('gpResults', ['$document', function(document) {
    return {
        scope: {},
        link: function(scope, element, attrs) {
            angular.element(document).bind('keyup', function(ev) {
                if (!scope.$parent.results || !scope.$parent.results.length) return;

                var results = scope.$parent.results;
                var index = scope.$parent.current;

                switch (ev.keyCode) {
                    case 13: // enter
                        scope.$parent.focus(results[index]);
                        break;
                    case 38: // Up
                        index -= 1;
                        break;
                    case 40: // Down
                        index += 1;
                        break;
                }
                scope.$parent.current = _.max([
                    0, _.min([index, results.length - 1])
                ]);
                scope.$apply();
            });
        }
    };
}]);

app.controller('AutocompleteController', ['$scope', '$timeout', '$http', 'gplocation', function(scope, timeout, http, location) {
    scope.init = function(url) {
        scope.url = url;
    };

    scope.focus = function(result) {
        scope.results = [];
        scope.selected = true;
        scope.search = result.name;
        
        location.update({
            lon: result.lon.toFixed(6),
            lat: result.lat.toFixed(6),
            zoom: 13
        });
    };

    var tm;

    scope.$watch('search', function(newValue) {
        if (scope.selected) {
            scope.selected = false;
            return;
        }
        if (!newValue) return;
        if (newValue.length < 3) {
            scope.results = [];
            scope.current = 0;
            return;
        }
        if (tm) {
            timeout.cancel(tm);
        }

        tm = timeout(function() {
            http.get(scope.url, {params: {q: newValue}}).then(function(data) {
                scope.results = data.data;
                scope.current = 0;
            });
        }, 400);
    });
}]);
