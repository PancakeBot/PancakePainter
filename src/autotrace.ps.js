/*
 * @file This PaperScript file controls the secondary paper instance in the app
 * for adjustment and preview of autotraced import user content before it gets
 * placed into the editor.
 */
 /* globals
   _, paper, Layer, Group, Raster, view, project, autoTraceLoadedInit, app,
   Shape, Point, mainWindow
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
 * @return {Promise}
 *   When promise is resolved, autotrace.tracebmp is saved & ready.
 */
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
  var lines, fills, mask;
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
      return paper.autotrace.getImageFills(img, options);
    }).then(function(data) {
      var offset = 6;
      fills = tempLayer.importSVG(data);

      // Reject the promise at this point as we have no lines or fills.
      if (!fills && !lines) {
        reject(Error('No data returned from trace.'));
      }

      mask = fills.clone();

      // Negative offset fills to destroy thin shapes.
      mask = paper.utils.offsetPath(mask.children[0], -offset, 5);

      // Only if there's a result from the destructive process above...
      if (mask) {
        // Then unoffset the same fill to use as a mask.
        mask = paper.utils.offsetPath(mask, offset, 5);
        paper.tracedGroup.addChild(mask);
      }

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
 * Normalize, cleanup & colorize the SVG created by the trace functions.
 */
function normalizeSVG() {
  autotrace.paper.activate();
  paper.utils.ungroupAllGroups(svgLayer);

};
  // Limit available autocolors for 1 color (2p) traces to the lightest shade.
  var limit = 4;
  if (autotrace.settings.posterize === '2') {
    limit = 1;
  }
  paper.utils.autoColor(svgLayer, limit);


// Autotrace preview should be done loading, trigger loadInit
autoTraceLoadedInit();
