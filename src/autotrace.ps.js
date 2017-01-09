/*
 * @file This PaperScript file controls the secondary paper instance in the app
 * for adjustment and preview of autotraced import user content before it gets
 * placed into the editor.
 */
 /* globals
   $, _, paper, Layer, Group, Raster, view, project, app, Path, Point,
   mainWindow
 */
 var jimp = require('jimp');

// Localize autotrace to be the parent window object (holds settings, paths).
var autotrace = mainWindow.overlay.windows.autotrace;
paper.strokeWidth = 5; // Custom

// Layer Management
paper.sepLayer = project.getActiveLayer();
var separator = new Path.Line(
  new Point(view.center.x, 0),
  new Point(view.center.x, view.bounds.height)
);
separator.strokeColor = 'white';
separator.strokeWidth = 3;

var imageLayer = new Layer(); // Behind the active layer
var tempLayer = new Layer(); // Hidden Temporary layer.
tempLayer.visible = false;

paper.imageLayer = imageLayer;
var svgLayer = new Layer(); // Everything is drawn here to output
paper.svgLayer = svgLayer;

// Load Salient Helpers
_.each(['utils', 'autotrace'], function(helperName) {
  paper[helperName] = require('./helpers/helper.' + helperName)(paper);
});

// Initialize the colors to snap to based on the pancake shades.
paper.utils.snapColorSetup(app.constants.pancakeShades);

/**
 * Initially load and size the input trace image, rasterizing and outputting
 * an intermediary file at a fixed size.
 * @return {Promise}
 *   When promise is resolved, autotrace.tracebmp is saved & ready.
 */
paper.loadTraceImage = function() {
  autotrace.paper.activate();
  imageLayer.removeChildren();
  imageLayer.activate();

  // Return promise to manage execution/failure.
  return new Promise(function(resolve) {
    // Resize source image to max 512px on a side, save it to intermediary.
    var tempPng = autotrace.intermediary;
    autotrace.sourceImage.contain(512, 512).write(tempPng, function() {
      var buster = Math.random().toString(36).substr(2, 5);
      autotrace.paper.activate();
      paper.traceImg = new Group([new Raster({
        source: autotrace.intermediary + "?cachebust=" + buster,
        position: view.center
      })]);

      // Really Paper? I shouldn't have to be so explicit.
      imageLayer.addChild(paper.traceImg);

      paper.traceImg.img = paper.traceImg.children[0];

      // When the image actually loads...
      paper.traceImg.img.onLoad = function() {
        paper.traceImg.pInitialBounds = this.bounds;

        // Scale image and set center position on the left.
        paper.utils.fitScale(this, view, 0.4);
        paper.traceImg.position.x = view.bounds.width / 4;

        // All done.
        resolve();
      };
    });
  });
};

/**
 * Render the trace raster intermediary image through jimp for extra processing
 * to create the final raster for tracing.
 * @param {String} [sourceFile=autotrace.intermediary]
 *   Souce input file to be converted to output BMP for tracing. If not given,
 *   will default to autotrace.intermediary.
 * @param {Object} [extraOptions={}]
 *   Optional extra options to be added for output.
 * @return {Promise}
 *   When promise is resolved, autotrace.tracebmp is saved & ready.
 */
paper.renderTraceImage = function(sourceFile, extraOptions) {
  sourceFile = sourceFile ? sourceFile : autotrace.intermediary;
  extraOptions = extraOptions ? extraOptions : {};

  return new Promise(function(resolve) {
    jimp.read(sourceFile)
    .then(function(img){
      if (extraOptions.mask) {
        return paper.maskImage(img, extraOptions.mask);
      } else {
        return img;
      }
    })
    .then(function(img) {
      // Background color
      var intColor = parseInt(
        autotrace.settings.transparent.replace('#', '0x') + 'FF'
      );
      img.background(intColor);

      // Blur.
      if (autotrace.settings.blur !== '0') {
        img.blur(parseInt(autotrace.settings.blur));
      }

      // Brightness.
      if (autotrace.settings.brightness !== '0') {
        img.brightness(parseFloat(autotrace.settings.brightness));
      }

      // Contrast.
      if (autotrace.settings.contrast !== '0') {
        img.contrast(parseFloat(autotrace.settings.contrast));
      }

      // Invert
      if (autotrace.settings.invert) {
        img.invert();
      }

      // Write final file.
      img.write(autotrace.tracebmp, resolve);
    });
  });
};

/**
 * Given a JIMP image, mask transparency given a bw/image given in mask object.
 * @param  {JIMP.image} img
 *   Image to be masked.
 * @param  {Object} mask
 *   Object containing offset {x, y} & mask.image JIMP image.
 * @return {Promise}
 *   Resolved promise returns image with mask applied.
 */
paper.maskImage = function(img, mask) {
  return new Promise(function(resolve) {
    jimp.read(mask.image).then(function(maskImg) {
      resolve(img.mask(maskImg, mask.offset.x, mask.offset.y));
    });
  });
};

/**
 * Render and display trace..
 * @return {Promise}
 *   When promise is resolved, tracing is complete.
 */
paper.renderTraceVector = function() {
  tempLayer.activate();
  tempLayer.removeChildren();

  switch (autotrace.settings.tracetype) {
    case 'mixed':
      return renderMixedVector();
    case 'fills':
      return renderFillsVector();
    case 'lines':
      return renderLinesVector();
  }
};

/**
 * Cleanup the image specific bits so we don't see them on next load.
 */
paper.cleanup = function() {
  svgLayer.removeChildren();
  imageLayer.removeChildren();
  $('div.trace-preview img.trace').remove();
};


//==============================================================================

/**
 * Render a fill only vector trace from the source bitmap.
 * @return {Promise}
 *   When promise is resolved, tracing is complete.
 */
function renderFillsVector() {
  var fills;
  var options = {
    backgroundColor: autotrace.settings.transparent.substr(1),
    colorCount: autotrace.settings.posterize,
  };

  var img = autotrace.tracebmp;
  return new Promise(function(resolve, reject) {
    paper.autotrace.getImageFills(img, options).then(function(data) {
      fills = tempLayer.importSVG(data);
      if (fills) {
        autotrace.paper.activate();
        paper.tracedGroup = fills;

        // Remove any previous work and append built data to svgLayer.
        svgLayer.removeChildren();
        svgLayer.addChild(paper.tracedGroup);

        // Normalize & recolor the final trace.
        normalizeSVG();

        // Flatten and subtract all fills together to ensure no underlapping.
        paper.utils.flattenSubtractLayer(svgLayer);

        // Resolve the promise.
        resolve();
      } else {
        reject(Error('No data returned from trace.'));
      }
    });
  });
}

/**
 * Render a centerline only vector trace from the source bitmap.
 * @return {Promise}
 *   When promise is resolved, tracing is complete.
 */
function renderLinesVector() {
  var lines;
  var options = {
    backgroundColor: autotrace.settings.transparent.substr(1),
    colorCount: autotrace.settings.posterize,
  };

  var img = autotrace.tracebmp;
  return new Promise(function(resolve, reject) {
    paper.autotrace.getImageLines(img, options).then(function(data) {
      lines = tempLayer.importSVG(data);
      if (lines) {
        lines.strokeWidth = 5;
        lines.strokeCap = 'round';
        autotrace.paper.activate();
        paper.utils.recursiveLengthCull(lines, 8);
        paper.tracedGroup = lines;

        // Remove any previous work and append built data to svgLayer.
        svgLayer.removeChildren();
        svgLayer.addChild(paper.tracedGroup);

        // Normalize & recolor the final trace.
        normalizeSVG();

        // Resolve the promise.
        resolve();
      } else {
        reject(Error('No data returned from trace.'));
      }
    });
  });
}

/**
 * Render a mixed line/fill vector trace from the source bitmap.
 * @return {Promise}
 *   When promise is resolved, tracing is complete.
 */
function renderMixedVector() {
  var lines, fills;
  var options = {
    backgroundColor: autotrace.settings.transparent.substr(1),
    colorCount: autotrace.settings.posterize,
  };

  var img = autotrace.tracebmp;
  return new Promise(function(resolve, reject) {
    paper.autotrace.getImageLines(img, options).then(function(data) {
      lines = tempLayer.importSVG(data);
      autotrace.paper.activate();
      paper.tracedGroup = new Group();

      if (lines) {
        paper.tracedGroup.addChild(lines);
        lines.strokeWidth = 5;
        lines.strokeCap = 'round';
        paper.utils.recursiveLengthCull(lines, 8); // Clean up noise lines.
      }

      return paper.autotrace.getImageFills(img, options);
    }).then(function(data) {
      fills = tempLayer.importSVG(data);

      // Reject the promise at this point as we have no lines or fills.
      if (!fills && !lines) {
        reject(Error('No data returned from line or fill trace.'));
      }

      paper.utils.flattenSubtractLayer(fills);

      // Calculate offset based on scale approximation and constant offset.
      var offset = autotrace.offset * (autotrace.cloneCount / 2);
      paper.utils.destroyThinFeatures(fills, offset);
      paper.tracedGroup.addChildren(fills.children);

      // Remove any previous work and append built data to svgLayer.
      svgLayer.removeChildren();
      svgLayer.addChild(paper.tracedGroup);

      normalizeSVG();

      // Resolve the promise.
      resolve();
    });
  });
}


/**
 * Normalize, cleanup & colorize the SVG created by the trace functions.
 * @param  {Paper.Layer} [layer=svgLayer]
 *   Layer to normalize, otherwise defaults to svgLayer.
 */
function normalizeSVG(layer) {
  layer = layer ? layer : svgLayer;

  autotrace.paper.activate();

  // Scale vectors and set center position on the right.
  paper.utils.fitScale(layer, view, 0.4);
  layer.position.y = view.center.y;
  layer.position.x = (view.bounds.width / 4) * 3;

  paper.utils.ungroupAllGroups(layer);

  // Limit available autocolors for 1 color (2p) traces to the lightest shade.
  var limit = 4;
  if (autotrace.settings.posterize === '2') {
    limit = 1;
  }
  paper.utils.autoColor(layer, limit);

  paper.renderPreviewRaster();
}

/**
 * Render the raster data of the svgLayer for clone preivew.
 */
paper.renderPreviewRaster = function(){
  // Generate raster preview.
  autotrace.previewRasterData = paper.utils.getDataURI(svgLayer);
};


// Native Paper.JS PaperScript Events ==========================================
// =============================================================================
function onMouseMove(event) { /* jshint ignore:line */
  svgLayer.selected = false;
  if (event.item && event.item.parent === svgLayer) {
    event.item.selected = true;
  }
}

function onMouseDown(event) { /* jshint ignore:line */
  var hitResult = project.hitTest(event.point, {
    stroke: true,
    segments: true,
    fill: true,
    tolerance: 5
  });
  if (!hitResult) return;

  var rightParent = hitResult.item.parent === svgLayer;
  if (!rightParent) {
    rightParent = hitResult.item.parent.parent === svgLayer;
  }

  if (hitResult && rightParent) {
    hitResult.item.remove();
    paper.renderPreviewRaster();
    autotrace.clonePreview();
    onResize();
  }
}

function onResize() {
  // Move the separator back to the center.
  separator.firstSegment.point = new Point(view.center.x, 0);
  separator.lastSegment.point = new Point(view.center.x, view.bounds.height);

  // Move and scale the layers.
  paper.utils.fitScale(imageLayer, view, 0.4);
  imageLayer.position = new Point(view.center.x/2, view.center.y);
  paper.utils.fitScale(svgLayer, view, 0.4);
  svgLayer.position = new Point((view.center.x/2) * 3, view.center.y);
}
