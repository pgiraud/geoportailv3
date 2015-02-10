/**
 * @fileoverview This file provides a "infobar" directive. This directive is
 * used to insert an Info Bar into the HTML page.
 * Example:
 *
 * <app-infobar app-infobar-map="::mainCtrl.map"map></app-infobar>
 *
 * Note the use of the one-time binding operator (::) in the map expression.
 * One-time binding is used because we know the map is not going to change
 * during the lifetime of the application.
 *
 */
goog.provide('app.infobarDirective');

goog.require('app');
goog.require('ol.control.MousePosition');


/**
 * @return {angular.Directive} The Directive Object Definition.
 * @ngInject
 */
app.infobarDirective = function(appInfobarTemplateUrl) {
  return {
    restrict: 'E',
    scope: {
      'map': '=appInfobarMap'
    },
    controller: 'AppInfobarController',
    controllerAs: 'ctrl',
    bindToController: true,
    templateUrl: appInfobarTemplateUrl
  };
};


app.module.directive('appInfobar', app.infobarDirective);


/**
 * @ngInject
 * @constructor
 */
app.InfobarDirectiveController = function($scope, $document) {
    $scope.projectionOptions = [
        {label: 'LUREF', value: 'EPSG:2169'},
        {label: 'Long/Lat WGS84', value: 'EPSG:4326'},
        {label: 'WGS84 UTM 32|31', value: 'EPSG:3263*'}
    ];
    $scope.projection = $scope.projectionOptions[0];
    this.mouseposition = new ol.control.MousePosition({
        className: 'custom-mouse-coordinates',
        target: $document.find('.mouse-coordinates')[0],
        projection: $scope.projection.value,
        coordinateFormat: function(coord){
            return _coordFormat(coord, $scope.projection.value);
        }
    });
    this['map'].addControl(this.mouseposition);

    function _utmZoneCheck(coord){
        //proj4.defs("EPSG:32632","+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");
        //var lonlat = ol.proj.transform(coord, this['map'].getView().getProjection() , "EPSG:4326");
        return "EPSG:4326";
       // if (lonlat.lon && Math.floor(lonlat.lon) >= 6){
       //     return "EPSG:32632"
       // } else {
       //     return "EPSG:32631";
       // }
    };

    function _coordFormat(coord, epsg_code){
        if (epsg_code === "EPSG:3263*"){
            var projection = ol.proj.get(_utmZoneCheck(coord));
            $scope.ctrl.mouseposition.setProjection(projection);
            epsg_code = projection.getCode();
        };
        switch(epsg_code){
            case "EPSG:2169":
            var template = '{x} E | {y} N';
            return ol.coordinate.format(coord, template, 0);
        case "EPSG:4326":
            var hdms = ol.coordinate.toStringHDMS(coord);
            var xhdms = hdms.split(" ").slice(0,4).join(" ");
            var yhdms = hdms.split(" ").slice(4,8).join(" ");
            var template = xhdms + ' ({x}) | ' +  yhdms +' ({y})';
            return ol.coordinate.format(coord, template, 5);
        case "EPSG:32632":
            var template = '{x} | {y} (UTM32N)';
            return ol.coordinate.format(coord, template, 0);
        case "EPSG:32631":
            var template = '{x} | {y} (UTM31N)';
            return ol.coordinate.format(coord, template, 0);
       }
    };

    $scope.switchProjection = function(){
        var projection = ol.proj.get(this.projection.value);
        var widget = this['ctrl'].mouseposition;
        widget.setProjection(projection);
        widget.setCoordinateFormat = function(coord) {
            return _coordFormat(coord, $scope.projection.value);
        }
    };
};


app.module.controller('AppInfobarController',
    app.InfobarDirectiveController);
