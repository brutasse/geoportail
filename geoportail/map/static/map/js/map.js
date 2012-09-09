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

		initialize: function(options) {
			var self = this;
			this.resize();
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
			this.bindSwitchers();
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
			var options = OpenLayers.Util.extend({
				territory: 'FXX',
				mode: 'mini',
			}, window.gGEOPORTALRIGHTSMANAGEMENT);
			var viewer = new Geoportal.Viewer.Default(this.options.container, options);
			var layer = this.options.layers[0];
			viewer.addGeoportalLayer(layer.code, this.layerOptions(layer.name));
			$('#' + layer.id).addClass('selected');
			this.viewer = viewer;
			this.defaultCenter();
		},

		width: function() {
			return window.innerWidth;
		},

		height: function() {
			return window.innerHeight;
		},

		resize: function() {
			if ('viewer' in this) {
				this.viewer.setSize(this.width(), this.height());
			} else {
				var container = document.getElementById('map');
				container.style.width = this.width() + "px";
				container.style.height = this.height() + "px";
			}
		},

		defaultCenter: function() {
			var center = new OpenLayers.LonLat(this.options.defaultCenter.lon, this.options.defaultCenter.lat).transform(new OpenLayers.Projection('EPSG:4326'), this.viewer.map.getProjection());
			this.viewer.map.setCenter(center, this.options.zoomLevel);
		},

		zoomTo: function(zoom) {
			this.viewer.map.setCenter(this.viewer.map.center, zoom);
		},

		switchTo: function(layer) {
			while (this.viewer.map.layers[2]) {
				this.viewer.map.layers[2].destroy();
			}
			this.viewer.addGeoportalLayer(layer.code, this.layerOptions(layer.name));
			for (var lyr in this.viewer.map.layers) {
				var l = this.viewer.map.layers[lyr];
				l.minZoomLevel = layer.minZoomLevel;
				l.maxZoomLevel = layer.maxZoomLevel;
			}
		},

		focus: function(lon, lat) {
			var center = new OpenLayers.LonLat(lon, lat).transform(new OpenLayers.Projection('EPSG:4326'), this.viewer.map.getProjection());
			this.viewer.map.setCenter(center, this.options.focusZoomLevel);
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

		bindSwitchers: function() {
			var self = this;
			$('#actions a').click(function(event) {
				var layerId = $(this).attr('id');
				if ($('#actions a.selected').attr('id') === layerId) {
					return;
				}
				$('#actions a').removeClass('selected');
				for (var lyr in self.options.layers) {
					var layer = self.options.layers[lyr];
					if (layer.id === $(this).attr('id')) {
						if (self.viewer.map.zoom > layer.maxZoomLevel) {
							self.zoomTo(layer.maxZoomLevel);
						}
						if (self.viewer.map.zoom < layer.minZoomLevel) {
							self.zoomTo(layer.minZoomLevel);
						}
						self.switchTo(layer);
						$(this).addClass('selected');
					}
				}
				event.preventDefault();
			});
		},

		CLASS_NAME: "Portal"
	});
	window.Portal = Portal;
})(jQuery);
