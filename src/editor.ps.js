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
  '#ffea7e',
  '#e2bc15',
  '#a6720e',
  '#714a00'
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

// TODO: Load all tools in folder based on weight
var toolPen = require('./tools/tool.pen')(paper);
var toolSelect = require('./tools/tool.select')(paper);

var $editor = $('#editor');
paper.setCursor = function(type) {
  // TODO: Implement cursor change on hover of handles, objects, etc
  //if (!type) type = 'default';
  //$editor.css('cursor', type);
}

var lastCenter = view.center;
function onResize(event) {
  var vector = lastCenter - view.center;

  paper.mainLayer.position-= vector;
  paper.imageLayer.position-= vector;

  lastCenter = view.center;
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
    }, function(filePath){
      if (!filePath) {  // Open cancelled
        paper.finishImageImport();
        return;
      }

      paper.imageLayer.activate(); // Draw the raster to the image layer
        var img = new Raster({
          source: dataURI(filePath[0]),
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

  view.update();
}

// Called when completing image import management
paper.finishImageImport = function() {
  activateToolItem('#tool-pen');
  toolPen.activate();
  toolSelect.imageTraceMode(false);
}


// Clear the existing project workspace (no confirmation)
paper.newPBP = function(noLayers) {
  paper.deselect();

  paper.imageLayer.remove();
  paper.mainLayer.remove();
  project.clear();

  if (paper.traceImage) {
    paper.traceImage.remove();
    paper.traceImage = null;
  }

  if (!noLayers) {
    paper.imageLayer = project.getActiveLayer(); // Creates the default layer
    paper.mainLayer = new Layer(); // Everything is drawn on here by default now
  }

  view.update();

  // Reset current file status (keeping previous file name, for kicks)
  currentFile.name = "";
  currentFile.changed = false;
}

// Render the text/SVG for the pancakebot project files
paper.getPBP = function(){
  paper.deselect(); // Don't export with something selected!

  // Save this layer's known center so it can be adjusted for when loaded.
  paper.mainLayer.data.viewCenter = view.center;
  return project.exportJSON();
}

// Called whenever the file is changed from a tool
paper.fileChanged = function() {
  currentFile.changed = true;
}

// Load a given PBP filepath into the project workspace
paper.loadPBP = function(filePath){
  paper.newPBP(true);

  currentFile.name = path.parse(filePath).base;
  currentFile.path = filePath;
  currentFile.changed = false;

  project.importJSON(fs.readFileSync(filePath, "utf8"));

  paper.imageLayer = project.layers[0];
  paper.mainLayer = project.layers[1];

  paper.mainLayer.activate();

  // Adjust offset position based on difference between current view center and
  // view center stored in the mainLayer data view center.
  var vector = paper.mainLayer.data.viewCenter - view.center;
  paper.mainLayer.position-= vector;
  paper.imageLayer.position-= vector;

  // Reinstate traceImage, if any.
  if (paper.imageLayer.children.length) {
    paper.traceImage = paper.imageLayer.children[0];
    paper.traceImage.img = paper.traceImage.children[0];
  }

  toastr.info(i18n.t('file.opened', {file: currentFile.name}));
  view.update();
}

// Editor should be done loading, trigger loadInit
editorLoadedInit();
