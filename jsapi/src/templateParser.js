goog.provide('lux.TemplateParser');


lux.TemplateParser = function(options) {
  var promise = fetch(options.template).then(function(resp) {
    return resp.text();
  }).then(function(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    var elements = div.childNodes;
    document.body.appendChild(div);

    div.scope = {
      layers: options
    };

    // search for directive and expressions to evaluate
    this.parseNode(div);
  }.bind(this));
};

lux.TemplateParser.prototype.parseNode = function(node) {
  // NamedNodeMap
  var attributes = node.attributes;

  if (attributes) {
    var i;
    var len = attributes.length;
    var match;
    var name;
    var attribute;
    for (i = 0; i < len; i++) {
      attribute = attributes.item(i);
      name = attribute.name;
      value = attribute.value;
      node.removeAttribute(name);
      switch (name) {
        case 'ng-repeat':
          this.parseNgRepeat(node, value);
          return;
      }
    }
  }

  if (node.nodeType == Node.TEXT_NODE) {
    this.parseTextNode(node);
  }

  node.childNodes.forEach(function(child) {
    if (!child.scope) {
      child.scope = node.scope;
    }
    this.parseNode(child);
  }.bind(this));
};


lux.TemplateParser.prototype.parseNgRepeat = function(node, expression) {
  // taken from https://github.com/angular/angular.js/blob/13b7bf0bb5262400a06de6419312fe3010f79cb2/src/ng/directive/ngRepeat.js#L362
  var match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)?\s*$/);

  if (!match) {
    console.error('invalid ng-repeat expression');
  }

  var lhs = match[1];
  var rhs = match[2];

  var i;
  function index(obj, i) {
    return obj[i];
  }
  // equivalent to node.scope[rhs] but takes dots into account
  var collection = rhs.split('.').reduce(index, node.scope);
  var len = collection.length;
  for (i = 0; i < len; i++) {
    var clone = node.cloneNode(true);
    clone.scope = {};
    clone.scope[lhs] = collection[i];
    node.parentNode.appendChild(clone);
  }

  // remove the original node
  node.parentNode.removeChild(node);
};

lux.TemplateParser.prototype.parseTextNode = function(node) {
  var startSymbol = '{{',
      endSymbol = '}}',
      startSymbolLength = startSymbol.length,
      endSymbolLength = endSymbol.length,
      escapedStartRegexp = new RegExp(startSymbol.replace(/./g, escape), 'g'),
      escapedEndRegexp = new RegExp(endSymbol.replace(/./g, escape), 'g');

  function unescapeText(text) {
    return text.replace(escapedStartRegexp, startSymbol).
      replace(escapedEndRegexp, endSymbol);
  }

  // courtesy of https://github.com/tschaub/jugl
  function evalInScope(str, scope) {
    var args = [];
    var vals = [];
    for (key in scope) {
      args.push(key);
      vals.push(scope[key]);
    }
    var evaluator = new Function(args.join(","), "return " + str);
    return evaluator.apply({}, vals);
  }

  var text = node.textContent;
  var expressions = [];
  var textLength = text.length;

  var startIndex,
      endIndex,
      index = 0,
      exp,
      concat = [];

  while (index < textLength) {
    if (((startIndex = text.indexOf(startSymbol, index)) !== -1) &&
        ((endIndex = text.indexOf(endSymbol, startIndex + startSymbolLength)) !== -1)) {
      if (index !== startIndex) {
        concat.push(unescapeText(text.substring(index, startIndex)));
      }
      exp = text.substring(startIndex + startSymbolLength, endIndex);
      concat.push(evalInScope(exp, node.scope));

      index = endIndex + endSymbolLength;
    } else {
      // we did not find an interpolation, so we have to add the remainder to
      // the separators array
      if (index !== textLength) {
        concat.push(unescapeText(text.substring(index)));
      }
      break;
    }
    node.textContent = concat.join('');
  }

};
