/*
 * @file This PaperScript file controls the main PancakeCreator SVG Editor and
 * all importing/exporting of its data.
 */

paper.strokeWidth = 5; // Custom
paper.settings.handleSize = 10;

// Hold onto the base colors for the palette (also custom)
paper.pancakeShades = [
  '#f2e3bf',
  '#d9a944',
  '#bb792f',
  '#875027'
];

paper.pancakeCurrentShade = 0;

var values = {
  paths: 5,
  minPoints: 5,
  maxPoints: 15,
  minRadius: 30,
  maxRadius: 90
};

createPaths();

var toolPen = require('./tools/tool.pen')(paper);
var toolSelect = require('./tools/tool.select')(paper);

function createPaths() {
  var radiusDelta = values.maxRadius - values.minRadius;
  var pointsDelta = values.maxPoints - values.minPoints;
  for (var i = 0; i < values.paths; i++) {
    var radius = values.minRadius + Math.random() * radiusDelta;
    var points = values.minPoints + Math.floor(Math.random() * pointsDelta);
    var path = createBlob(view.size * Point.random(), radius, points);
    path.strokeColor = paper.pancakeShades[0];
    path.strokeWidth = paper.strokeWidth;
  };
}

function createBlob(center, maxRadius, points) {
  var path = new Path();
  path.closed = true;
  for (var i = 0; i < points; i++) {
    var delta = new Point({
      length: (maxRadius * 0.5) + (Math.random() * maxRadius * 0.5),
      angle: (360 / points) * i
    });
    path.add(center + delta);
  }
  path.smooth();
  return path;
}

var $editor = $('#editor');
paper.setCursor = function(type) {
  // TODO: We'll get back to this, if needed.
  //if (!type) type = 'default';
  //$editor.css('cursor', type);
}

function onResize(event) {
  project.activeLayer.position = view.center;
  view.zoom = scale/2.5;
}

// Editor should be done loading, trigger loadInit
editorLoadedInit();
