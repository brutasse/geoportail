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

	var Portal = {
		init: function(options) {
			Portal.options = options;
			Portal.resize();
			Geoportal.GeoRMHandler.getConfig([Portal.options.apiKey], null, null, {
				onContractsComplete: Portal.loadMap,
			});
			if (options.autocomplete) {
				Portal.autocomplete();
			}
			Portal.options.layers = Portal.options.layers || [{
				id: 'maps',
				name: 'Maps',
				code: 'GEOGRAPHICALGRIDSYSTEMS.MAPS:WMTS',
				minZoomLevel: 0,
				maxZoomLevel: 18,
			}];
			Portal.options.defaultCenter = Portal.options.defaultCenter || {
				lon: 2,
				lat: 47,
			};
			Portal.options.zoomLevel = Portal.options.zoomLevel || 6;
			Portal.options.focusZoomLevel = Portal.options.focusZoomLevel || 13;
			Portal.bindSwitchers();
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
			var viewer = new Geoportal.Viewer.Default(Portal.options.container, options);
			var layer = Portal.options.layers[0];
			viewer.addGeoportalLayer(layer.code, Portal.layerOptions(layer.name));
			$('#' + layer.id).addClass('selected');
			Portal.viewer = viewer;
			Portal.defaultCenter();
		},

		width: function() {
			return window.innerWidth;
		},

		height: function() {
			return window.innerHeight;
		},

		resize: function() {
			if ('viewer' in Portal) {
				Portal.viewer.setSize(Portal.width(), Portal.height());
			} else {
				var container = document.getElementById('map');
				container.style.width = Portal.width() + "px";
				container.style.height = Portal.height() + "px";
			}
			var menu = document.getElementById('menu');
			menu.style.width = Portal.width() - 10 + "px";
		},

		defaultCenter: function() {
			var center = new OpenLayers.LonLat(Portal.options.defaultCenter.lon, Portal.options.defaultCenter.lat).transform(new OpenLayers.Projection('EPSG:4326'), Portal.viewer.map.getProjection());
			Portal.viewer.map.setCenter(center, Portal.options.zoomLevel);
		},

		zoomTo: function(zoom) {
			Portal.viewer.map.setCenter(Portal.viewer.map.center, zoom);
		},

		switchTo: function(layer) {
			while (Portal.viewer.map.layers[2]) {
				Portal.viewer.map.layers[2].destroy();
			}
			Portal.viewer.addGeoportalLayer(layer.code, Portal.layerOptions(layer.name));
			for (var lyr in Portal.viewer.map.layers) {
				var l = Portal.viewer.map.layers[lyr];
				l.minZoomLevel = layer.minZoomLevel;
				l.maxZoomLevel = layer.maxZoomLevel;
			}
		},

		focus: function(lon, lat) {
			var center = new OpenLayers.LonLat(lon, lat).transform(new OpenLayers.Projection('EPSG:4326'), Portal.viewer.map.getProjection());
			Portal.viewer.map.setCenter(center, Portal.options.focusZoomLevel);
		},

		autocomplete: function() {
			$('.autocomplete').autocomplete(Portal.options.autocomplete, {
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
				if (!data[1]) {
					$('input.autocomplete').val('');
					return;
				}
				lon = data[1].split(' ')[0];
				lat = data[1].split(' ')[1];
				Portal.focus(lon, lat);
			});
		},

		bindSwitchers: function() {
			$('#actions a').click(function(event) {
				var layerId = $(this).attr('id');
				if ($('#actions a.selected').attr('id') === layerId) {
					return;
				}
				$('#actions a').removeClass('selected');
				for (var lyr in Portal.options.layers) {
					var layer = Portal.options.layers[lyr];
					if (layer.id === $(this).attr('id')) {
						if (Portal.viewer.map.zoom > layer.maxZoomLevel) {
							Portal.zoomTo(layer.maxZoomLevel)
						}
						if (Portal.viewer.map.zoom < layer.minZoomLevel) {
							Portal.zoomTo(layer.minZoomLevel)
						}
						Portal.switchTo(layer);
						$(this).addClass('selected');
					}
				}
				event.preventDefault();
			});
		},
	};
	window.Portal = Portal;

	$(window).resize(function(event) {
		Portal.resize();
	});
})(jQuery);
