/**
 * @fileoverview This service keeps and share the state of the theme.
 */
goog.provide('app.Theme');

goog.require('app.Themes');
goog.require('ngeo.Location');


/**
 * @typedef {{push: function(Array<string>)}}
 */
app.Piwik;


/**
 * @constructor
 * @param {angular.$window} $window Global Scope.
 * @param {ngeo.Location} ngeoLocation ngeo Location service.
 * @param {app.Themes} appThemes The themes services.
 * @param {app.ScalesService} appScalesService Service returning scales.
 * @param {Array.<number>} maxExtent Constraining extent.
 * @ngInject
 */
app.Theme = function($window, ngeoLocation, appThemes,
    appScalesService, maxExtent) {

  /**
   * @const
   * @private
   * @type {Object}
   */
  this.piwikSiteIdLookup_ = {
    'main': 18,
    'tourisme': 7,
    'emwelt': 8,
    'eau': 6,
    'pag' : 19
  };

  /**
   * @type {angular.$window}
   * @private
   */
  this.window_ = $window;

  /**
   * @type {app.ScalesService}
   * @private
   */
  this.scales_ = appScalesService;

  /**
   * @type {ol.Extent}
   * @private
   */
  this.maxExtent_ =
      ol.proj.transformExtent(maxExtent, 'EPSG:4326', 'EPSG:3857');

  /**
   * @type {app.Themes}
   * @private
   */
  this.appThemes_ = appThemes;

  /**
   * @type {string}
   * @private
   */
  this.currentTheme_ = app.Theme.DEFAULT_THEME_;

  /**
   * @type {ngeo.Location}
   * @private
   */
  this.ngeoLocation_ = ngeoLocation;
};


/**
 * @param {string} themeId The id of the theme.
 * @param {ol.Map} map The map object.
 */
app.Theme.prototype.setCurrentTheme = function(themeId, map) {
  this.currentTheme_ = themeId;

  var piwikSiteId = this.piwikSiteIdLookup_[this.currentTheme_];
  if (!goog.isDefAndNotNull(piwikSiteId)) {
    piwikSiteId = this.piwikSiteIdLookup_[app.Theme.DEFAULT_THEME_];
  }
  var piwik = /** @type {app.Piwik} */ (this.window_['_paq']);
  piwik.push(['setSiteId', piwikSiteId]);
  piwik.push(['trackPageView']);

  this.setLocationPath_(this.currentTheme_);
  this.appThemes_.getThemeObject(this.currentTheme_).then(goog.bind(
      /**
       * @param {Object} tree Tree object for the theme.
       */
      function(tree) {
        if (!goog.isNull(tree)) {
          goog.asserts.assert('metadata' in tree);
          var maxZoom = 19;
          if (!goog.string.isEmptySafe(tree['metadata']['resolutions'])) {
            var resolutions = tree['metadata']['resolutions'].split(',');
            maxZoom = resolutions.length + 7;
          }
          var currentView = map.getView();
          map.setView(new ol.View({
            maxZoom: maxZoom,
            minZoom: 8,
            extent: this.maxExtent_,
            center: currentView.getCenter(),
            enableRotation: false,
            zoom: currentView.getZoom()
          }));
          this.scales_.setMaxZoomLevel(maxZoom);
        }},this));
};


/**
 * @return {string} themeId The id of the theme.
 */
app.Theme.prototype.getCurrentTheme = function() {
  return this.currentTheme_;
};


/**
 * @return {string} themeId The id of the theme.
 */
app.Theme.prototype.getDefaultTheme = function() {
  return app.Theme.DEFAULT_THEME_;
};


/**
 * @param {string} themeId The theme id to set in the path of the URL.
 * @private
 */
app.Theme.prototype.setLocationPath_ = function(themeId) {
  var pathElements = this.ngeoLocation_.getPath().split('/');
  goog.asserts.assert(pathElements.length > 1);
  if (pathElements[pathElements.length - 1] === '') {
    // case where the path is just "/"
    pathElements.splice(pathElements.length - 1);
  }
  if (this.themeInUrl(pathElements)) {
    pathElements[pathElements.length - 1] = themeId;
  } else {
    pathElements.push('theme', themeId);
  }
  this.ngeoLocation_.setPath(pathElements.join('/'));
};


/**
 * Return true if there is a theme specified in the URL path.
 * @param {Array.<string>} pathElements Array of path elements.
 * @return {boolean} theme in path.
 */
app.Theme.prototype.themeInUrl = function(pathElements) {
  var indexOfTheme = pathElements.indexOf('theme');
  return indexOfTheme >= 0 &&
      pathElements.indexOf('theme') == pathElements.length - 2;
};


/**
 * @const
 * @private
 */
app.Theme.DEFAULT_THEME_ = 'main';

app.module.service('appTheme', app.Theme);
