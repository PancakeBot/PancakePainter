/*
 * @file This PaperScript file controls the main PancakeCreator SVG Editor and
 * all importing/exporting of its data.
 */

paper.strokeWidth = 5; // Custom
paper.settings.handleSize = 10;

// Layer Management (custom vars)
paper.imageLayer = project.getActiveLayer(); // Behind the active layer
paper.mainLayer = new Layer(); // Everything is drawn on here by default now

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
  paper.mainLayer.position = view.center;
  paper.imageLayer.position = view.center;
  view.zoom = scale/2.5;
}

// Initialize (or edit) an image import for tracing on top of
paper.initImageImport = function() {
  if (!paper.traceImage) {
    mainWindow.dialog({
      type: 'OpenDialog',
      title: i18n.t('import.title'),
      filters: [
        { name: i18n.t('import.files'), extensions: ['jpg', 'jpeg', 'gif', 'png'] }
      ]
    }, function(path){
      if (!path) {  // Open cancelled
        paper.finishImageImport();
        return;
      }

      paper.imageLayer.activate(); // Draw the raster to the image layer
        var img = new Raster({
          source: 'file://' + path,
          position: view.center
        });
        // The raster MUST be in a group to alleviate coordinate & scaling issues.
        paper.traceImage = new Group([img]);
        paper.traceImage.img = img;
      paper.mainLayer.activate(); // We're done with the image layer for now

      // TODO: Bad images never trigger onload
      img.onLoad = function() {
        // Size the image down
        var scale = {
          x: (view.bounds.width * 0.8) / this.width,
          y: (view.bounds.height * 0.8) / this.height
        }

        paper.traceImage.pInitialBounds = this.bounds;

        // Use the smallest scale
        scale = (scale.x < scale.y ? scale.x : scale.y);
        paper.traceImage.scale(scale);

        paper.traceImage.opacity = 0.5;

        // Select the thing and disable other selections
        toolSelect.imageTraceMode(true);
      }
    });
  } else {
    // Select the thing and disable other selections
    toolSelect.imageTraceMode(true);
  }

  paper.view.update();
}

// Called when completing image import management
paper.finishImageImport = function() {
  activateToolItem('#tool-pen');
  toolPen.activate();
  toolSelect.imageTraceMode(false);
}


// Editor should be done loading, trigger loadInit
editorLoadedInit();
