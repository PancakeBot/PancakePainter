/*
 * @file This PaperScript file controls the secondary paper instance in the app
 * for adjustment and preview of autotraced import user content before it gets
 * placed into the editor.
 */
 /* globals
   _, paper, Layer, Group, Raster, view, project, autoTraceLoadedInit, app,
   Shape, Point, mainWindow
 */

// Localize autotrace to be the parent window object (holds settings, paths).
var autotrace = mainWindow.overlay.windows.autotrace;
paper.strokeWidth = 5; // Custom

// Layer Management
var sepLayer = project.getActiveLayer();
var shape = new Shape.Rectangle(
  new Point(view.center.x, 0),
  new Point(view.center.x+2, view.bounds.height)
);
shape.fillColor = 'white';

var imageLayer = new Layer(); // Behind the active layer
var tempLayer = new Layer(); // Hidden Temporary layer.
tempLayer.visible = false;

var svgLayer = new Layer(); // Everything is drawn here to output

// Load Salient Helpers
_.each(['utils', 'autotrace'], function(helperName) {
  paper[helperName] = require('./helpers/helper.' + helperName)(paper);
});

// ============================================================================
// How should this work:
// 1. Initially load the image on window load (this saves the bmp to be traced)
// 2. Have a reload function (called immediately) that re-runs the traces
// required
// 3. Trigger each on update

var jimp = require('jimp');

// Initially load the trace image
paper.loadTraceImage = function() {
  imageLayer.removeChildren();
  imageLayer.activate();

  // Return promise to manage execution/failure.
  return new Promise(function(resolve, reject) {
    try {
      paper.traceImg = new Group([new Raster({
        source: autotrace.source,
        position: view.center
      })]);

      paper.traceImg.img = paper.traceImg.children[0];

      // When the image actually loads...
      paper.traceImg.img.onLoad = function() {
        // Size the image down
        var scale = {
          x: (view.bounds.width * 0.4) / this.width,
          y: (view.bounds.height * 0.8) / this.height
        };

        paper.traceImg.pInitialBounds = this.bounds;

        // Use the smallest scale.
        scale = (scale.x < scale.y ? scale.x : scale.y);
        paper.traceImg.scale(scale);
        paper.traceImg.position.x = view.bounds.width / 4;

        // Finish off by saving the image out as a base resized PNG.
        var tmpFile = autotrace.intermediary;
        paper.utils.saveRasterImage(paper.traceImg, 72, tmpFile).then(resolve);
      };
    } catch(e) {
      reject(Error(e));
    }
  });
};

// Render the trace image through jimp for vector tracing.
paper.renderTraceImage = function() {
  return new Promise(function(resolve, reject) {
    try {
      jimp.read(autotrace.intermediary).then(function(img) {
        // Background color
        var intColor = parseInt(
          autotrace.settings.transparent.replace('#', '0x') + 'FF'
        );
        img.background(intColor);

        // Blur.
        if (autotrace.settings.blur !== '0') {
          img.blur(parseInt(autotrace.settings.blur));
        }

        // Invert
        if (autotrace.settings.invert) {
          img.invert();
        }

        img.write(autotrace.tracebmp, function() {
          resolve();
        });
      });
    } catch(e) {
      reject(Error(e));
    }
  });
};

// Render and display the trace.
paper.renderTraceVector = function() {
  tempLayer.activate();
  tempLayer.removeChildren();

  switch (autotrace.settings.tracetype) {
    case 'mixed':
      paper.renderMixedVector();
      break;
    case 'fills':
      paper.renderFillsVector();
      break;
    case 'lines':
      paper.renderLinesVector();
      break;
  }
};

paper.renderMixedVector = function() {
  var lines, fills, mask;
  var options = {
    backgroundColor: autotrace.settings.transparent.substr(1),
    colorCount: autotrace.settings.posterize,
  };

  var img = autotrace.tracebmp;
  paper.autotrace.getImageLines(img, options).then(function(data) {
    lines = tempLayer.importSVG(data);
    autotrace.paper.activate();
    paper.tracedGroup = new Group([lines]);

    lines.strokeWidth = 5;
    return paper.autotrace.getImageFills(img, options);
  }).then(function(data) {
    var offset = 6;
    fills = tempLayer.importSVG(data);

    mask = fills.clone();

    // Negative offset fills to destroy thin shapes.
    mask = paper.utils.offsetPath(mask.children[0], -offset, 3);

    // Only if there's a result from the destructive process above...
    if (mask) {
      // Then unoffset the same fill to use as a mask.
      mask = paper.utils.offsetPath(mask, offset, 3);
      paper.tracedGroup.addChild(mask);
    }

    paper.tracedGroup.position.y = view.center.y;
    paper.tracedGroup.position.x = (view.bounds.width / 4) * 3;

    // Remove any previous work and append built data to svgLayer.
    svgLayer.removeChildren();
    svgLayer.addChild(paper.tracedGroup);
  });
};

paper.renderFillsVector = function() {
  var fills;
  var options = {
    backgroundColor: autotrace.settings.transparent.substr(1),
    colorCount: autotrace.settings.posterize,
  };

  var img = autotrace.tracebmp;
  paper.autotrace.getImageFills(img, options).then(function(data) {
    fills = tempLayer.importSVG(data);
    autotrace.paper.activate();
    paper.tracedGroup = fills;

    paper.tracedGroup.position.y = view.center.y;
    paper.tracedGroup.position.x = (view.bounds.width / 4) * 3;

    // Remove any previous work and append built data to svgLayer.
    svgLayer.removeChildren();
    svgLayer.addChild(paper.tracedGroup);
  });
};

paper.renderLinesVector = function() {
  var lines;
  var options = {
    backgroundColor: autotrace.settings.transparent.substr(1),
    colorCount: autotrace.settings.posterize,
  };

  var img = autotrace.tracebmp;
  paper.autotrace.getImageLines(img, options).then(function(data) {
    lines = tempLayer.importSVG(data);
    autotrace.paper.activate();
    paper.tracedGroup = lines;

    paper.tracedGroup.position.y = view.center.y;
    paper.tracedGroup.position.x = (view.bounds.width / 4) * 3;

    // Remove any previous work and append built data to svgLayer.
    svgLayer.removeChildren();
    svgLayer.addChild(paper.tracedGroup);
  });
};




// Autotrace preview should be done loading, trigger loadInit
autoTraceLoadedInit();
