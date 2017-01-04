/*
 * @file This PaperScript file controls the secondary paper instance in the app
 * for adjustment and preview of autotraced import user content before it gets
 * placed into the editor.
 */
 /* globals
   $, _, paper, Layer, Group, Raster, view, project, autoTraceLoadedInit, app,
   Shape, Point, mainWindow, CompoundPath
 */
 var jimp = require('jimp');

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
paper.renderTraceImage = function(
  sourceFile = autotrace.intermediary,
  extraOptions = {}
) {

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

      // Invert
      if (autotrace.settings.invert) {
        img.invert();
      }

      // Write final file.
      img.write(autotrace.tracebmp, function() {
        resolve();
      });
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

        paper.tracedGroup.position.y = view.center.y;
        paper.tracedGroup.position.x = (view.bounds.width / 4) * 3;

        // Remove any previous work and append built data to svgLayer.
        svgLayer.removeChildren();
        svgLayer.addChild(paper.tracedGroup);

        // Normalize & recolor the final trace.
        normalizeSVG();

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
        autotrace.paper.activate();
        paper.utils.recursiveLengthCull(lines, 8);
        paper.tracedGroup = lines;

        paper.tracedGroup.position.y = view.center.y;
        paper.tracedGroup.position.x = (view.bounds.width / 4) * 3;

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
      paper.tracedGroup = new Group([lines]);
      lines.strokeWidth = 5;
      paper.utils.recursiveLengthCull(lines, 8); // Clean up noise lines.
      return paper.autotrace.getImageFills(img, options);
    }).then(function(data) {
      fills = tempLayer.importSVG(data);

      // Reject the promise at this point as we have no lines or fills.
      if (!fills && !lines) {
        reject(Error('No data returned from trace.'));
      }

      paper.utils.flattenSubtractLayer(fills);
      paper.utils.destroyThinFeatures(fills, autotrace.offset);
      paper.tracedGroup.addChildren(fills.children);

      paper.tracedGroup.position.y = view.center.y;
      paper.tracedGroup.position.x = (view.bounds.width / 4) * 3;

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
 * Generate fills and lines for a given shade in a trace.
 * @param  {[type]} fillPaths [description]
 * @return {[type]}           [description]
 */
function generateMixedTraceShade(fillPaths) {
  return new Promise(function(resolve, reject) {
    console.log('Generate Trace Shade:', fillPaths.length);
    var out = {
      fills: {},
      lines: {},
    };

    // Quick resolve from empty input
    if (!fillPaths || !fillPaths.length) {
      resolve(out);
      return;
    }

    // Setup...
    autotrace.paper.activate();
    tempLayer.activate();
    tempLayer.removeChildren();

    var lineRaster = path.join(app.getPath('temp'), 'pp_lineraster.png');
    var options = {
      backgroundColor: autotrace.settings.transparent.substr(1),
      colorCount: 2, // Only ever trace one color at a time (plus transparent)
    };

    var color = fillPaths[0].fillColor;
    var colorFillGroup = new Group(fillPaths);
    tempLayer.addChildren(colorFillGroup);
    tempLayer.visible = true; // Prep for rasterization.

    // Create fill blobs from destructive fills.
    var blobGroup = colorFillGroup.clone();
    paper.utils.destroyThinFeatures(blobGroup, autotrace.offset);

    // Get a copy that isn't on any layers for final compositing.
    out.fills = blobGroup.clone(false);

    // Convert the two groups into compound paths, and subtract them.
    blobGroup.remove();
    colorFillGroup.remove();
    blobGroup = new CompoundPath({
      children: blobGroup.removeChildren()
    });
    colorFillGroup = new CompoundPath({
      children: colorFillGroup.removeChildren()
    });

    // Offset blobs by 1 to overlap a little more.
    paper.utils.offsetPath(blobGroup, 1, 2, true);

    // Subtract the fill mask to create what will be vectorized and line traced.
    var maskedFills = colorFillGroup.subtract(blobGroup);
    maskedFills.fillColor = color;
    //maskedFills.strokeColor = color;

    paper.utils.saveRasterImage(tempLayer, 72 * 2, lineRaster)
      .then(autotrace.paper.renderTraceImage)
      .then(function() {
        // Cleanup the bits we used to get here.
        tempLayer.removeChildren();

        // Add the fills back in.
        tempLayer.addChild(out.fills);
        return paper.autotrace.getImageLines(autotrace.tracebmp, options);
      })
      .then(function(linesSVG) {
        var lines = tempLayer.importSVG(linesSVG);
        if (lines) {
          lines.scale(0.5, lines.bounds.topLeft);
          lines.strokeWidth = 5;
          paper.utils.recursiveLengthCull(lines, 5);
          out.lines = lines;
        }

        // Finally complete.
        svgLayer.addChild(out.lines);
        svgLayer.addChild(out.fills);
        resolve(out);
      }).catch(function(error){
        console.log('FAIL', error);
        reject(error);
      });
  });
}

/**
 * Render a mixed line/fill vector trace from the source bitmap (Mutli shades).
 * @return {Promise}
 *   When promise is resolved, tracing is complete.
 */
function renderMixedVectorMultiShade() {

  return new Promise(function(resolve, reject) {
    // Proposed method:
    // 1. Get traced fills, boolean fills against each other (flatten).
    // 2. Match posterized colors
    // 3. Split each fill set into filled color groups
    // 4. Apply destructive fill inset/offset for each color group

    // Go render a full fills trace all the way.
    renderFillsVector().then(function() {
      if (!svgLayer.children.length) {
        reject(Error('No trace result given'));
        return;
      }

      autotrace.paper.activate();
      tempLayer.activate();

      // Final color blob fills after destructive processes and trimmed lines.

      // Move through each fill object and group it by color.
      var colorSeps = {};
      var fills = svgLayer.removeChildren();
      _.each(fills, function(item) {
        var key = 'color' + item.data.color;
        if (!colorSeps[key]) {
          colorSeps[key] = [item];
        } else {
          colorSeps[key].push(item);
        }
      });

      // Move through each group of items of a specific color and add them to
      // the tempLayer, export this as a raster, and centerline trace it.

      // We create the start of a promise chain
      var chain = Promise.resolve();

      // And append each function in the array to the promise chain
      _.each(colorSeps, function(items) {
        chain = chain.then(generateMixedTraceShade.bind(null, items));
      });

      chain.then(function(){
        console.log('I think its done!');
      });

      chain.then(resolve);
    });
  });
}

/**
 * Normalize, cleanup & colorize the SVG created by the trace functions.
 * @param  {Paper.Layer} [layer=svgLayer]
 *   Layer to normalize, otherwise defaults to svgLayer.
 */
function normalizeSVG(layer = svgLayer) {
  autotrace.paper.activate();
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


// HOVER/CLICK REMOVE ==========================================================
// =============================================================================
var hitOptions = {
  stroke: true,
  fill: true,
  tolerance: 5
};

function onMouseDown(event) { /* jshint ignore:line */
  var hitResult = project.hitTest(event.point, hitOptions);
  if (!hitResult) return;

  if (hitResult) {
    hitResult.item.remove();
    paper.renderPreviewRaster();
    autotrace.clonePreview();
  }
}

function onMouseMove(event) { /* jshint ignore:line */
  svgLayer.selected = false;
  if (event.item && event.item.parent === svgLayer) {
    event.item.selected = true;
  }
}


// Autotrace preview should be done loading, trigger loadInit
autoTraceLoadedInit();
