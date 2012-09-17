(function($) {
	/**
	 * This monkeypatch is gross but works. Sometimes we don't have all that
	 * info but it seems to be always the same. 256x256 and 20037508 as tile
	 * origin.
	 */
	Geoportal.Layer.WMTS.prototype.getTileInfo = function(f) {
		var g, j, e, a, i;
		if(this.nativeResolution) {
			g = this.nativeResolution;
			if (this.nativeTileSize) {
				j = this.nativeTileSize.w;
				e = this.nativeTileSize.h;
			} else {
				j = 256;
				e = 256;
			}
			if (this.nativeTileOrigin) {
				a=this.nativeTileOrigin.lon;
				i=this.nativeTileOrigin.lat;
			} else {
				a = -20037508;
				i = 20037508;
			}
		} else {
			g=this.map.getResolution();
			j=this.tileSize.w;
			e=this.tileSize.h;
			a=this.tileOrigin.lon;
			i=this.tileOrigin.lat;
		}
		var d=(f.lon-a)/(g*j);
		var c=(i-f.lat)/(g*e);
		var b=Math.floor(d);
		var k=Math.floor(c);
		return {
			col:b,
			row:k,
			i:Math.floor((d-b)*j),
			j:Math.floor((c-k)*e),
		}
	};

	Proj4js.loadScript = function () {
		return;
	};

	var parseQs = function(query) {
		if (query === "") {
			return {};
		}
		var parsed = {};
		for (var key in query) {
			var pair = query[key].split('=');
			if (pair.length != 2) {
				continue;
			}
			parsed[pair[0]] = decodeURIComponent(pair[1].replace(/\+/g, " "));
			if (parseFloat(parsed[pair[0]])) {
				parsed[pair[0]] = parseFloat(parsed[pair[0]]);
			}
		}
		return parsed;
	};

	var Portal = OpenLayers.Class({
		/**
		 * Default, overridable options.
		 */
		options: {
			/**
			 * API key that's used on http://api.ign.fr/tech-docs-js/examples/
			 * Safe for development.
			 */
			apiKey: "1711091050407331029",
			layers: [{
				id: 'maps',
				name: 'Maps',
				code: 'GEOGRAPHICALGRIDSYSTEMS.MAPS:WMTS',
				minZoomLevel: 0,
				maxZoomLevel: 18,
			}],
			/**
			 * Center of France
			 * http://toolserver.org/~geohack/geohack.php?pagename=Centre_de_la_France&language=fr&params=46_36_22_N_01_52_31_E_
			 */
			defaultCenter: {
				lon: 1.875278,
				lat: 46.606111,
			},
			zoomLevel: 6,
			focusZoomLevel: 13,
		},

		/**
		 * When moving the map while handling a popstate event, 'moveend' is
		 * triggered and calls pushState() again, breaking the next button. This
		 * switch disables moveend handling when loading a previous state.
		 */
		handleMoveend: true,

		initialize: function(options) {
			var self = this;
			options.layers = options.layers || this.options.layers;
			options.defaultCenter = options.defaultCenter || this.options.defaultCenter;
			options.zoomLevel = options.zoomLevel || this.options.zoomLevel;
			options.focusZoomLevel = options.focusZoomLevel || this.options.focusZoomLevel;
			this.options = options;

			Geoportal.GeoRMHandler.getConfig([options.apiKey], null, null, {
				onContractsComplete: function() {
					self.loadMap();
				}
			});
			if (options.autocomplete) {
				this.autocomplete();
			}
			this.bindActions();
			$(window).resize(function(event) {
				self.resize();
			});
		},

		layerOptions: function(name) {
			return {
				name: name,
				visibility: true,
				opacity: 1,
				buffer: 1,
				transitionEffect: 'resize',
			};
		},

		loadMap: function() {
			var self = this;
			var options = OpenLayers.Util.extend({
				territory: 'FXX',
				mode: 'mini',
			}, window.gGEOPORTALRIGHTSMANAGEMENT);
			var viewer = new Geoportal.Viewer.Default(this.options.container, options);
			var layer = this.options.layers[0];
			var params = parseQs(window.location.search.substr(1).split('&'));
			if (params.layer) {
				for (var lyr in this.options.layers) {
					if (this.options.layers[lyr].id === params.layer) {
						layer = this.options.layers[lyr];
					}
				}
			}
			$('#' + layer.id).addClass('selected');
			viewer.addGeoportalLayer(layer.code, this.layerOptions(layer.name));
			this.viewer = viewer;
			this.map = viewer.map;

			params.zoom = params.zoom || this.options.zoomLevel;
			params.lon = params.lon || this.options.defaultCenter.lon;
			params.lat = params.lat || this.options.defaultCenter.lat;
			params.layer = params.layer || this.options.layers[0].id;
			this.focusTo(params);

			this.map.events.register('moveend', this.map, function(ev) {
				if (self.handleMoveend) {
					self.onEvent(ev);
				}
			});

			if (!!(window.history && history.pushState)) {
				var popped = ('state' in window.history && window.history.state !== null);
				var initialURL = location.href;
				window.addEventListener('popstate', function(e) {
					// detect initial (useless) popstate
					var initialPop = !popped && location.href == initialURL;
					popped = true;
					if (initialPop) {
						return;
					}
					if (e.state) {
						self.handleMoveend = false;
						self.focusTo(e.state);
						self.handleMoveend = true;
					}
				});
			}
		},

		width: function() {
			return window.innerWidth;
		},

		height: function() {
			return window.innerHeight;
		},

		resize: function() {
			this.viewer.setSize(this.width(), this.height());
		},

		onEvent: function(ev) {
			var params = this.mapParams();
			var qs = $.param(params);

			if (!!(window.history && history.pushState)) {
				if (location.search.substr(1) != qs) {
					history.pushState(params, null, '?' + qs);
				}
			}
		},

		focusTo: function(params) {
			var center = new OpenLayers.LonLat(params.lon, params.lat).transform(new OpenLayers.Projection('EPSG:4326'), this.map.getProjection());
			this.map.setCenter(center, params);
			this.zoomTo(params.zoom);
			if (params.layer != $('#actions .selected').attr('id')) {
				for (var lyr in this.options.layers) {
					if (this.options.layers[lyr].id === params.layer) {
						$('#actions a').removeClass('selected');
						this.switchTo(this.options.layers[lyr]);
						$('#' + params.layer).addClass('selected');
					}
				}
			}
		},

		zoomTo: function(zoom) {
			this.map.setCenter(this.map.center, zoom);
		},

		switchTo: function(layer) {
			while (this.map.layers[2]) {
				this.map.layers[2].destroy();
			}
			this.viewer.addGeoportalLayer(layer.code, this.layerOptions(layer.name));
			for (var lyr in this.map.layers) {
				var l = this.map.layers[lyr];
				l.minZoomLevel = layer.minZoomLevel;
				l.maxZoomLevel = layer.maxZoomLevel;
			}
			if (!this.handleMoveend) {
				return;
			}
			this.onEvent(); // fire an event yo
		},

		focus: function(lon, lat) {
			var center = new OpenLayers.LonLat(lon, lat).transform(new OpenLayers.Projection('EPSG:4326'), this.map.getProjection());
			this.map.setCenter(center, this.options.focusZoomLevel);
		},

		autocomplete: function() {
			var self = this;
			$('.autocomplete').autocomplete(this.options.autocomplete, {
				width: 350,
				height: 200,
				minChars: 3,
				max: 15,
				scrollHeight: window.innerHeight - 50,
				formatResult: function(data, value) {
					if (value.indexOf(' <em>') === -1) {
						return value;
					}
					return value.split(' <em>')[0];
				},
				highlight: function(value, term) {
					return value;
				},
			}).result(function(event, data, formatted) {
				if (!data) {
					return;
				}
				if (!data[1]) {
					$('input.autocomplete').val('');
					return;
				}
				lon = data[1].split(' ')[0];
				lat = data[1].split(' ')[1];
				self.focus(lon, lat);
			});
		},

		bindActions: function() {
			var self = this;
			$('#actions a').click(function(e) {
				e.preventDefault();
				var layerId = $(this).attr('id');
				if ($('#actions a.selected').attr('id') === layerId) {
					return;
				}
				$('#actions a').removeClass('selected');
				for (var lyr in self.options.layers) {
					var layer = self.options.layers[lyr];
					if (layer.id === $(this).attr('id')) {
						if (self.map.zoom > layer.maxZoomLevel) {
							self.zoomTo(layer.maxZoomLevel);
						}
						if (self.map.zoom < layer.minZoomLevel) {
							self.zoomTo(layer.minZoomLevel);
						}
						$(this).addClass('selected');
						self.switchTo(layer);
					}
				}
			});
		},

		mapParams: function() {
			var center = this.map.center.clone().transform(
				this.map.getProjection(),
				new OpenLayers.Projection('EPSG:4326')
			);
			return {
				layer: $('#actions .selected').attr('id'),
				zoom: this.map.zoom,
				lon: center.lon.toFixed(6),
				lat: center.lat.toFixed(6),
			};
		},

		CLASS_NAME: "Portal"
	});
	window.Portal = Portal;
})(jQuery);
