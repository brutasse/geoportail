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
    var scope;
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

    var init = function(params) {
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
        if (!scope) return;
        config = get_map_config();
        set_layer(config.layer);
        view.setCenter(ol.proj.transform([config.lon, config.lat], wgs84, mercator));
        view.setZoom(config.zoom || 13);
    };

    /**
     * Registers the event handler for location changes.
     */
    var set_scope = function(controller_scope) {
        scope = controller_scope;
        scope.$on('$locationChangeSuccess', focus);
    };

    return {
        init: init,
        get_map_config: get_map_config,
        set_scope: set_scope
    };
}]);

app.directive('gpMap', ['map', function(map) {
    return function(scope, element, attrs) {
        map.init(attrs);
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

app.directive('gpSwitch', ['$timeout', function(timeout) {
    return {
        scope: {
            'layer': '&',
        },
        link: function(scope, element, attrs) {
            scope.$parent.$watch('layer', function(newValue) {
                element.toggleClass('selected', newValue === attrs.id);
            });
            element.bind('click', function() {
                timeout(function() {
                    scope.$parent.set_layer(attrs.id);
                });
            });
        }
    };
}]);

app.controller('LayerController', ['$scope', 'gplocation', 'map', function(scope, location, map) {
    scope.layer = map.get_map_config().layer;

    scope.set_layer = function(layer) {
        scope.layer = layer;
    };

    scope.$watch('layer', function(newValue) {
        location.update({layer: newValue});
    });

    map.set_scope(scope);
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
        if (newValue.length < 3) return;
        if (tm) {
            timeout.cancel(tm);
        }

        tm = timeout(function() {
            http.get(scope.url, {params: {q: newValue}}).then(function(data) {
                scope.results = data.data;
            });
        }, 400);
    });
}]);
