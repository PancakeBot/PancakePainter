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

// Handy translated color names
paper.pancakeShadeNames = [];
_.each(paper.pancakeShades, function(color, index){
  paper.pancakeShadeNames.push(i18n.t('color.color' + index));
});

paper.pancakeCurrentShade = 0;

var values = {
  paths: 5,
  minPoints: 5,
  maxPoints: 15,
  minRadius: 30,
  maxRadius: 90
};

var toolPen = require('./tools/tool.pen')(paper);
var toolSelect = require('./tools/tool.select')(paper);

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
