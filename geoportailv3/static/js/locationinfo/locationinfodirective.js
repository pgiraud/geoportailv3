/**
 * @fileoverview This file provides a "location information" directive.
 */

goog.provide('app.LocationinfoController');
goog.provide('app.locationinfoDirective');

goog.require('app');
goog.require('app.CoordinateString');
goog.require('app.Geocoding');
goog.require('app.GetDevice');
goog.require('app.GetElevation');
goog.require('app.GetShorturl');
goog.require('app.StateManager');
goog.require('ngeo.FeatureOverlay');
goog.require('ngeo.FeatureOverlayMgr');
goog.require('ol.proj');


/**
 * @param {string} appLocationinfoTemplateUrl The template.
 * @return {angular.Directive} The directive.
 * @ngInject
 */
app.locationinfoDirective = function(appLocationinfoTemplateUrl) {
  return {
    restrict: 'E',
    scope: {
      'map': '=appLocationinfoMap',
      'open': '=appLocationinfoOpen',
      'hiddenContent': '=appLocationinfoHiddenContent',
      'appSelector': '=appLocationinfoAppselector'
    },
    controller: 'AppLocationinfoController',
    controllerAs: 'ctrl',
    bindToController: true,
    templateUrl: appLocationinfoTemplateUrl
  };
};

app.module.directive('appLocationinfo', app.locationinfoDirective);


/**
 * @constructor
 * @param {angular.Scope} $scope The scope.
 * @param {angular.$timeout} $timeout The timeout service.
 * @param {ngeo.FeatureOverlayMgr} ngeoFeatureOverlayMgr Feature overlay
 * manager.
 * @param {app.GetShorturl} appGetShorturl The short url service.
 * @param {app.GetElevation} appGetElevation The elevation service.
 * @param {app.CoordinateString} appCoordinateString The coordinate to string
 * service.
 * @param {app.StateManager} appStateManager The state manager service.
 * @param {string} qrServiceUrl The qr service url.
 * @param {string} appLocationinfoTemplateUrl The template url.
 * @param {app.SelectedFeatures} appSelectedFeatures Selected features service.
 * @param {app.Geocoding} appGeocoding appGeocoding The geocoding service.
 * @param {app.GetDevice} appGetDevice The device service.
 * @ngInject
 */
app.LocationinfoController = function(
        $scope, $timeout, ngeoFeatureOverlayMgr,
        appGetShorturl, appGetElevation, appCoordinateString, appStateManager,
        qrServiceUrl, appLocationinfoTemplateUrl, appSelectedFeatures,
        appGeocoding, appGetDevice) {

  /**
   * @private
   * @type {app.GetDevice}
   */
  this.appGetDevice_ = appGetDevice;

  /**
   * @type {app.CoordinateString}
   * @private
   */
  this.coordinateString_ = appCoordinateString;

  /**
   * @type {ngeo.FeatureOverlay}
   * @private
   */
  this.featureOverlay_ = ngeoFeatureOverlayMgr.getFeatureOverlay();

  var defaultFill = new ol.style.Fill({
    color: [255, 255, 0, 0.6]
  });
  var circleStroke = new ol.style.Stroke({
    color: [255, 155, 55, 1],
    width: 3
  });

  var pointStyle = new ol.style.Circle({
    radius: 10,
    fill: defaultFill,
    stroke: circleStroke
  });

  this.featureOverlay_.setStyle(
      /**
       * @param {ol.Feature|ol.render.Feature} feature Feature.
       * @param {number} resolution Resolution.
       * @return {Array.<ol.style.Style>} Array of styles.
       */
      function(feature, resolution) {
        return [new ol.style.Style({
          image: pointStyle
        })];
      });

  $scope.$watch(goog.bind(function() {
    return this['appSelector'];
  }, this), goog.bind(function(newVal) {
    if (newVal != 'locationinfo') {
      this.featureOverlay_.clear();
    }
  }, this));

  $scope.$watch(goog.bind(function() {
    return this['open'];
  }, this), goog.bind(function(newVal, oldVal) {
    if (newVal == oldVal) {
      return;
    }
    if (newVal === false) {
      this['hiddenContent'] = false;
      this.stateManager_.updateState({'crosshair': false});
      var mapCenterCoordinate = this['map'].getView().getCenter();
      this.stateManager_.updateState({
        'X': parseInt(mapCenterCoordinate[0], 0),
        'Y': parseInt(mapCenterCoordinate[1], 0)
      });
      this['appSelector'] = undefined;
      this['location'] = {};
      this.featureOverlay_.clear();
    }
  }, this));

  /**
   * @type {string}
   */
  this['url'] = '';

  /**
   * @type {string}
   */
  this['qrUrl'] = '';

  /**
   * @type {string}
   */
  this['elevation'] = '';

  /**
   * @type {string}
   */
  this['address'] = '';

  /**
   * @type {string}
   */
  this['distance'] = '';

  /**
   * @type {app.GetElevation}
   * @private
   */
  this.getElevation_ = appGetElevation;

  /**
   * @type {app.Geocoding}
   * @private
   */
  this.geocode_ = appGeocoding;

  /**
   * @type {app.GetShorturl}
   * @private
   */
  this.getShorturl_ = appGetShorturl;

  /**
   * @type {string}
   * @private
   */
  this.qrServiceUrl_ = qrServiceUrl;

  /**
   * @type {Object.<string, string>}
   * @private
   * @const
   */
  this.projections_ = {
    'EPSG:2169': 'Luref',
    'EPSG:4326': 'Lon/Lat WGS84',
    'EPSG:4326:DMS': 'Lon/Lat WGS84 DMS',
    'EPSG:3263*': 'WGS84 UTM'
  };

  /**
   * @type {Object}
   */
  this['location'] = {};

  /**
   * @type {app.StateManager}
   * @private
   */
  this.stateManager_ = appStateManager;

  /**
   * @type {Object<number, number>}
   */
  var startPixel = null;

  /**
   * @type {angular.$q.Promise|undefined}
   */
  var holdPromise;

  // Load infowindow if crosshair variable is set
  var urlLocationInfo = appStateManager.getInitialValue('crosshair');
  if (goog.isDefAndNotNull(urlLocationInfo) &&
      urlLocationInfo === 'true') {
    var x = parseInt(appStateManager.getInitialValue('X'), 0);
    var y = parseInt(appStateManager.getInitialValue('Y'), 0);
    var version = this.stateManager_.getVersion();

    if (goog.isDef(x) && goog.isDef(y)) {
      var coordinate = version === 3 ?
          /** @type {ol.Coordinate} */ ([x, y]) :
          /** @type {ol.Coordinate} */ (ol.proj.transform([y, x], 'EPSG:2169',
              this['map'].getView().getProjection()));
      this.loadInfoPane_(coordinate);
      var env = this.appGetDevice_();
      if (env !== 'xs') {
        this['open'] = true;
        this['hiddenContent'] = false;
      } else {
        this['hiddenContent'] = true;
      }
    }
  }

  ol.events.listen(this['map'], ol.MapBrowserEvent.EventType.POINTERDOWN,
      goog.bind(function(event) {
        if (!appSelectedFeatures.getLength()) {
          if (event.originalEvent.which === 3) { // if right mouse click
            this.loadInfoPane_(event.originalEvent);
            this['open'] = true;
          } else if (!(event.originalEvent instanceof MouseEvent)) {
            // if touch input device
            $timeout.cancel(holdPromise);
            startPixel = event.pixel;
            var that = this;
            holdPromise = $timeout(function() {
              that.loadInfoPane_(event.originalEvent);
              that['open'] = true;
            }, 500, false);
          }
        }
      }, this), this);

  ol.events.listen(this['map'], ol.MapBrowserEvent.EventType.POINTERUP,
      goog.bind(function(event) {
        $timeout.cancel(holdPromise);
        startPixel = null;
      }, this), this);

  ol.events.listen(this['map'], ol.MapBrowserEvent.EventType.POINTERMOVE,
      goog.bind(function(event) {
        if (startPixel) {
          var pixel = event.pixel;
          var deltaX = Math.abs(startPixel[0] - pixel[0]);
          var deltaY = Math.abs(startPixel[1] - pixel[1]);
          if (deltaX + deltaY > 6) {
            $timeout.cancel(holdPromise);
            startPixel = null;
          }
        }
      }, this), this);

  this['map'].getViewport()
    .addEventListener('contextmenu', goog.bind(function(event) {
      event.preventDefault(); // disable right-click menu on browsers
    }, this));

};


/**
 * @param {ol.Coordinate} coordinate The coordinate.
 * @private
 */
app.LocationinfoController.prototype.updateLocation_ = function(coordinate) {
  this['location'] = {};
  goog.object.forEach(this.projections_, function(value, key) {
    var sourceEpsgCode = this['map'].getView().getProjection().getCode();
    if (key === 'EPSG:4326:DMS') {
      var epsgCode = goog.string.remove(key, ':DMS');
      this['location'][value] = this.coordinateString_(
          coordinate, sourceEpsgCode, epsgCode, true);
    } else {
      this['location'][value] = this.coordinateString_(
          coordinate, sourceEpsgCode, key);
    }
  }, this);
};


/**
 * @param {MouseEvent|TouchEvent|ol.Coordinate} eventOrCoordinate The event or
 * The coordinate.
 * @private
 */
app.LocationinfoController.prototype.loadInfoPane_ =
    function(eventOrCoordinate) {
      var clickCoordinate;
      if (eventOrCoordinate instanceof Array) {
        clickCoordinate = eventOrCoordinate;
      } else {
        eventOrCoordinate.preventDefault();
        clickCoordinate = this['map'].getEventCoordinate(eventOrCoordinate);
      }

      this['appSelector'] = 'locationinfo';
      this.stateManager_.updateState({'crosshair': true});
      this.updateLocation_(clickCoordinate);
      var feature = /** @type {ol.Feature} */
      (new ol.Feature(new ol.geom.Point(clickCoordinate)));
      this.featureOverlay_.clear();
      this.featureOverlay_.addFeature(feature);
      this.getElevation_(clickCoordinate).then(goog.bind(
      function(elevation) {
        this['elevation'] = elevation;
      }, this
      ));
      this.getShorturl_(clickCoordinate).then(goog.bind(
      function(shorturl) {
        this['url'] = shorturl;
        this['qrUrl'] = this.qrServiceUrl_ + '?url=' + shorturl;
      }, this));
      this['address'] = '';
      this['distance'] = '';
      this.geocode_.reverseGeocode(clickCoordinate).then(goog.bind(function(resp) {
        if (resp['count'] > 0) {
          var address = resp['results'][0];
          var formattedAddress = address['number'] + ',' + address['street'] + ',' +
          address['postal_code'] + ' ' + address['locality'];
          this['address'] = formattedAddress;
          this['distance'] = Math.round(address['distance']);
        }
      }, this));
    };

app.module.controller('AppLocationinfoController', app.LocationinfoController);
