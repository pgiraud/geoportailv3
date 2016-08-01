goog.provide('query_template');

goog.require('lux.TemplateParser');

var result = {
  ordered: false,
  layer: "147",
  remote_template: false,
  features: [
    {
      geometry: {
        type: "Point",
        coordinates: [
          89785.0715870248,
          92713.9732033133
        ]
      },
      attributes: {
        name: "Colbette",
        url: "http://travelplanner.mobiliteit.lu/hafas/help.exe/dn?tpl=infobox&iblayout=1&ibname=Colbette&ibextid=170405005&ibinit=box_2"
      },
      type: "Feature",
      fid: "147_170405005"
    }
  ],
  template: "templates/bus.html"
};

var result = {
  features: {
    foo: 'bar'
  },
  template: 'templates/foo.html'
};

var parser = new lux.TemplateParser(result);
