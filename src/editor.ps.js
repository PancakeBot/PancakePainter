/*
 * @file This PaperScript file controls the main PancakePainter SVG Editor and
 * all importing/exporting of its data.
 */
 /* globals
   window, mainWindow, _, toastr, i18n, paper, view, project, scale,
   Raster, Group, Point, Path, PathItem, Layer, Potrace, currentFile, path,
   fs, editorLoadedInit, saveAs, Rectangle, selectColor
 */

/*jshint bitwise: false*/
var dataURI = require('datauri');

/// Tracing parameters
paper.defaultColorAmount = 2;
paper.defaultEdgeFidelity = 0;

paper.ColorAmount = paper.defaultColorAmount;   // From 2 to 4
paper.EdgeFidelity = paper.defaultEdgeFidelity; // Edge Fidelity

// Same as cleanParameter but this value will be
// scaled with screen resolution and saved in
// cleanParameter. THIS is the value you want
// to modify
paper.cleanParameterToScale = 50;
paper.cleanParameter = paper.cleanParameterToScale; // Clean little segments

paper.ImportedSVGLayers = []; // SVG Layers
paper.ColorMapping = []; // Color Mapping
paper.globalPath = ''; // Current loaded path
paper.maxSideValue = 400; // Max side scale value
/// End tracing parameters

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
_.each(paper.pancakeShades, function(color, index){ /* jshint unused:false */
  paper.pancakeShadeNames.push(i18n.t('color.color' + index));
});

paper.pancakeCurrentShade = 0;

// TODO: Load all tools in folder based on weight
var toolPen = require('./tools/tool.pen')(paper);
var toolFill = require('./tools/tool.fill')(paper); /* jshint ignore:line */
var toolSelect = require('./tools/tool.select')(paper);

// Load Helpers
paper.undo = require('./helpers/helper.undo')(paper);
paper.clipboard = require('./helpers/helper.clipboard')(paper);

paper.setCursor = function(type) {
  // TODO: Implement cursor change on hover of handles, objects, etc
  if (!type) type = 'default';
};

function onResize(event) { /* jshint ignore:line */
  // Ensure paper project view retains correct scaling and position.
  view.zoom = scale;
  var corner = view.viewToProject(new Point(0,0));
  view.scrollBy(new Point(0,0).subtract(corner));
}

// Initialize (or edit) an image import for tracing on top of
paper.initImageImport = function(options) {
  if (!paper.traceImage) {
    mainWindow.dialog({
      t: 'OpenDialog',
      title: i18n.t('import.title'),
      filters: [
        {
          name: i18n.t('import.files'),
          extensions: ['jpg', 'jpeg', 'gif', 'png']
        }
      ]
    }, function(filePath) {
      if (!filePath) {  // Open cancelled
        paper.finishImageImport();
        return;
      }

      // Keep track of the path
      var path = filePath[0];
      paper.globalPath = filePath[0];

      // Check the file type
      if(options.mode === 'vectorize') {
        // Vectorize
        paper.importForKmeans(path);
      } else {
        paper.importImage(path);
      }
    });
  } else {
    // Select the thing and disable other selections
    toolSelect.imageTraceMode(true);
  }

  view.update();
};

// actually does the image importing
paper.importImage = function(filePath) {
  paper.imageLayer.activate(); // Draw the raster to the image layer
  var img = new Raster({
    source: dataURI(filePath),
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
    };

    paper.traceImage.pInitialBounds = this.bounds;

    // Use the smallest scale
    scale = (scale.x < scale.y ? scale.x : scale.y);
    paper.traceImage.scale(scale);

    paper.traceImage.opacity = 0.5;

    // Select the thing and disable other selections
    toolSelect.imageTraceMode(true);
  };
};

// Called when completing image import management
paper.finishImageImport = function() {
  window.activateToolItem('#tool-pen');
  toolPen.activate();
  toolSelect.imageTraceMode(false);
  view.update();
};

// Shortcut for deferring logic to paperscript from app.js.
paper.selectAll = function() {
  if (paper.tool.name !== "tools.select") {
    window.activateToolItem('#tool-select');
    toolSelect.activate();
  }

  toolSelect.selectAll();
};

// Clear the existing project workspace/file (no confirmation)
paper.newPBP = function(noLayers) {
  paper.emptyProject();

  if (!noLayers) {
    paper.imageLayer = project.getActiveLayer(); // Creates the default layer
    paper.mainLayer = new Layer(); // Everything is drawn on here by default now
    paper.undo.clearState();
  }

  view.update();

  // Reset current file status (keeping previous file name, for kicks)
  currentFile.name = "";
  currentFile.changed = false;
};

// Just Empty/Clear the workspace.
paper.emptyProject = function() {
  paper.deselect();
  paper.selectRectLast = null;

  paper.imageLayer.remove();
  paper.mainLayer.remove();
  project.clear();
  project.activeLayer.clear();

  if (paper.traceImage) {
    paper.traceImage.remove();
    paper.traceImage = null;
  }
};

// Handle undo requests (different depending on if the tool cares).
paper.handleUndo = function(op) {
  // If the tool provides a function, and it returns false, don't run undo.
  if (typeof paper.tool.undoSet === 'function') {
    if (!paper.tool.undoSet(op)) {
      return;
    }
  }

  if (op === 'undo') {
    paper.undo.goBack();
  } else if (op === 'redo') {
    paper.undo.goForward();
  }
};

// Handle clipboard requests
paper.handleClipboard = function(op) {
  // Select all is being weird...
  // TODO: this probably shouldn't go here...
  if (op.ctrlKey && op.keyCode === 65) {
    paper.selectAll();
    return;
  }

  // For clarity, don't do any clipboard operations if not on the select tool.
  if (paper.tool.name !== 'tools.select') {
    return;
  }

  // Support "event" passthrough from window keydown event.
  var event = op;
  if (typeof op === 'object') {
    if (event.ctrlKey && event.keyCode === 67) {
      op = 'copy';
    }
    if (event.ctrlKey && event.keyCode === 88) {
      op = 'cut';
    }
    if (event.ctrlKey && event.keyCode === 86) {
      op = 'paste';
    }
    if (event.ctrlKey && event.keyCode === 68) {
      op = 'duplicate';
    }

    // If our captured keystroke didn't result in valid op, quit.
    if (typeof op !== 'string') {
      return;
    }

    // Prevent whatever else was going to happen.
    event.preventDefault();
  }

  switch (op) {
    case 'cut':
    case 'copy':
      paper.clipboard.copy(op === 'cut');
      break;
    case 'paste':
      paper.clipboard.paste();
      break;
    case 'duplicate':
      paper.clipboard.dupe();
      break;
  }
};


// Render the text/SVG for the pancakebot project files
paper.getPBP = function(){
  paper.deselect(); // Don't export with something selected!
  return project.exportJSON();
};

// Called whenever the file is changed from a tool
paper.fileChanged = function() {
  currentFile.changed = true;
  paper.undo.stateChanged();
};

// Stopgap till https://github.com/paperjs/paper.js/issues/801 is resolved.
// Clean a path of duplicated segment points, triggered on change/create
paper.cleanPath = function(path){
  _.each(path.segments, function(seg, index){
    if (index > 0 && typeof path.segments[index-1] !== 'undefined') {
      var lastP = path.segments[index-1].point;
      if (lastP.x === seg.point.x && lastP.y === seg.point.y) {
        // Duplicate point found, remove it.
        seg.remove();
      }
    }
  });
};

// Load a given PBP filepath into the project workspace
paper.loadPBP = function(filePath){
  paper.newPBP(true);

  currentFile.name = path.parse(filePath).base;
  currentFile.path = filePath;
  currentFile.changed = false;

  project.importJSON(fs.readFileSync(filePath, "utf8"));

  paper.imageLayer = project.layers[1];
  paper.mainLayer = project.layers[2];

  paper.mainLayer.activate();

  // Reinstate traceImage, if any.
  if (paper.imageLayer.children.length) {
    paper.traceImage = paper.imageLayer.children[0];
    paper.traceImage.img = paper.traceImage.children[0];
  }

  toastr.info(i18n.t('file.opened', {file: currentFile.name}));
  paper.undo.clearState();
  view.update();
};

// Convert the given path into a set of fill lines
paper.fillTracePath = function (fillPath, config) {
  // 1. Assume line is ALWAYS bigger than the entire object
  // 2. If filled path, number of intersections will ALWAYS be multiple of 2
  // 3. Grouping pairs will always yield complete line intersections.

  var lines = [];
  var line; // The actual line used to find the intersections
  var boundPath; // The path drawn around the object the line traverses

  var p = fillPath;
  var angle = config.fillAngle;
  var groupTheshold = config.fillGroupThreshold;
  var lineSpacing = config.fillSpacing;

  // Init boundpath and traversal line
  boundPath = new Path.Ellipse({
    center: p.position,
    size: [
      p.bounds.width + p.bounds.width/Math.PI,
      p.bounds.height + p.bounds.height/Math.PI
    ]
  });

  // Ensure line is far longer than the diagonal of the object
  line = new Path({
    segments: [new Point(0, 0), new Point(p.bounds.width + p.bounds.height, 0)]
  });

  // Set start & destination based on input angle

  // Divide the length of the bound ellipse into 1 part per angle
  var amt = boundPath.length/360;

  // Find destination position along ellipse and set to tangent angle
  var pos = amt * (angle + 180);
  line.position = boundPath.getPointAt(pos);
  line.rotation = angle + 90;

  // Find destination position on other side of circle
  pos = angle + 360;  if (pos > 360) pos -= 360;
  var destination = boundPath.getPointAt(pos * amt);

  // Find vector and vector length divided by line spacing to get # iterations.
  var vector = destination - line.position;
  var iterations = vector.length / lineSpacing;

  // Move through calculated iterations for given spacing
  for(var i = 0; i <= iterations; i++) {
    var ints = line.getIntersections(p);

    if (ints.length % 2 === 0) { // If not dividable by 2, we don't want it!
      for (var x = 0; x < ints.length; x+=2) {
        var groupingID = findGroup(ints[x].point, lines, groupTheshold);

        var y = new Path({
          segments: [ints[x].point, ints[x+1].point],
          data: {color: p.data.color}
        });

        if (!lines[groupingID]) lines[groupingID] = [];
        lines[groupingID].push(y);
      }
    }

    line.position+= vector / iterations;
  }

  // Combine lines within position similarity groupings
  var skippedJoins = 0;
  for (var g in lines) {
    var l = lines[g][0];

    for (i = 1; i < lines[g].length; i++) {
      // Don't join lines that cross outside the path
      var v = new Path({
        segments: [l.lastSegment.point, lines[g][i].firstSegment.point]
      });


      // Find a point halfway between where these lines would be connected
      // If it's not within the path, don't do it!
      var intersectionCount = v.getIntersections(p).length;
      if (!p.contains(v.getPointAt(v.length/2)) || intersectionCount > 3) {
        // Not contained, store the previous l & start a new grouping;
        l = lines[g][i];
        skippedJoins++;
      } else {
        l.join(lines[g][i]);
      }

      // Remove our test line
      v.remove();
    }
  }

  fillPath.remove(); // Remove the original fill path when we're done.
  line.remove();
  boundPath.remove();

  view.update();
};

// Find which grouping a given fill path should go with
function findGroup(testPoint, lines, newGroupThresh){
  // If we don't have any groups yet.. return 0
  if (lines.length === 0) {
    return 0;
  }

  // 1. We go in order, which means the first segment point of the last
  //    line in each group is the one to check distance against
  // 2. Compare each, use the shortest...
  // 3. ...unless it's above the new group threshold, then return a group id

  var vector = -1;
  var bestVector = newGroupThresh;
  var groupID = 0;
  for (var i = 0; i < lines.length; i++) {
    vector = lines[i][lines[i].length-1].firstSegment.point - testPoint;

    if (vector.length < bestVector) {
      groupID = i;
      bestVector = vector.length;
    }
  }

  // Check if we went over the threshold, make a new group!
  if (bestVector === newGroupThresh) {
    groupID = lines.length;
  }

  return groupID;
}

/////////////////////////////////////////////////
/////////// IMAGE TRACING CODE BY SUR3D /////////
/////////////////////////////////////////////////

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   {number}  r       The red color value
 * @param   {number}  g       The green color value
 * @param   {number}  b       The blue color value
 * @return  {Array}           The HSL representation
 */
function rgbToHsl(r, g, b){
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;

  if(max === min){
    h = s = 0; // achromatic
  }else{
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch(max){
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return [h, s, l];
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

paper.computeClosestColors = function(kmeans) {

  // Access centroids
  var centroids = kmeans.centroids;

  // HSL colors
  var lCentroids = [];
  var hslColor;

  // Convert each to HSL
  for(var i = 0; i < paper.ColorAmount; i++)
  {
    // Get centroid and transform
    hslColor = rgbToHsl(centroids[i][0],centroids[i][1],centroids[i][2]);
    lCentroids[i] = hslColor[2];
  }

  // Convert also the PancakePainter palette to hsl color space
  var lPalette = [];

  for(i = 0; i < paper.pancakeShades.length; i++)
  {
    // First convert from Hex to RGB
    var rgbColor = hexToRgb(paper.pancakeShades[i]);

    // Convert to hsl
    hslColor = rgbToHsl(rgbColor.r,rgbColor.g,rgbColor.b);

    // Finally push
    lPalette[i] = hslColor[2];
  }

  // Now, the mapping
  for(i = 0; i < paper.ColorAmount; i++)
  {
    // For each light value in l_centroids, find the closest in l_palette
    // No repetitions allowed

    var minimalDiff = 999999;
    var minimalC = -1;
    var minimalP = -1;

    // For each centroid
    // jshint maxdepth:5
    for(var c = 0; c < lCentroids.length; c++)
    {
      // For each color in palette
      for(var p = 0; p < lPalette.length; p++)
      {
        // Check colors has not been matched before
        if((lCentroids[c] !== -1)&&(lPalette[p]!==-1))
        {
          // Compute difference
          var currentDiff = Math.abs(lCentroids[c]-lPalette[p]);

          //Keep the difference if smallest so far
          if(currentDiff < minimalDiff)
          {
            minimalDiff = currentDiff;
            minimalC = c;
            minimalP = p;
          }
        }
      }
    }

    // Add the mapping
    paper.ColorMapping[minimalC] = minimalP;

    // Ensure minimal_c and minimal_p can't never be chosen again
    lCentroids[minimalC] = -1;
    lPalette[minimalP] = -1;
  }
};

var pos = 1;

// Loops over each layer to vectorize them and load into paper.js.
// When finished, it calls center and cut to finish the loading process.
// The callback argument is optional, if passed the function will be called when
//  the processing is finished
var loopLayersArray = function(binaryLayers, ctx, imageData, canvas,
                               callback) {

  processLayer(binaryLayers[pos], ctx, imageData, canvas, function() {
    try {
      // set x to next item
      pos++;

      // any more items in array? continue loop
      if(pos < binaryLayers.length) {
        loopLayersArray(binaryLayers, ctx, imageData, canvas, callback);
      }
      else { // When finished loading
        paper.centerAndCutImportedSVG();
        if(callback) {
          callback();
        }
      }
    }
    catch (e) {
      if(callback) {
        callback(e);
      }
    }
  });
};

paper.existingIDs = [];
paper.lastTracedGroup = null;

// Loads an computes the kmeans for each image layer. Returns a promise which is
//  resolved when the processing is finished
paper.importForKmeans = function(filePath) {

  if(!filePath) return;

  // Get all the IDs of the current items
  paper.existingIDs = project.activeLayer.getItems({}).map(function (item) {
    return item.id;
  });

  var promise = new Promise(function (resolve, reject) {
    // Open raster image
    var imageObj = new Image();
    imageObj.src = filePath;
    console.log(imageObj);

    // When the image has loaded...
    imageObj.onload = function() {

      try{

        // Sizes of the canvas
        var canvasWidth = this.width;
        var canvasHeight = this.height;

        // Scale down if a side is > max side value
        if((this.width > paper.maxSideValue) ||
            (this.height > paper.maxSideValue))
        {
          if(this.width > this.height)
          {
            canvasHeight = (paper.maxSideValue/this.width) * this.height;
            canvasWidth  = paper.maxSideValue;
          }
          else {
            canvasWidth  = (paper.maxSideValue/this.height) * this.width;
            canvasHeight = paper.maxSideValue;
          }
        }

        // Get data
        // First create fake canvas
        var canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Copy the image contents to the canvas to get data vector
        var ctx = canvas.getContext("2d");
        ctx.drawImage(this, 0, 0,canvasWidth,canvasHeight);
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var data = imageData.data;

        // Detect the background color and how much colors are in the image
        var bgColor = detectBackgroundColor(
            data, canvas.width, canvas.height, 10)[1];
        var colorCount = detectBackgroundColor(
            data, canvas.width, canvas.height, 100)[0];
        console.log('Detected background color is: ' + bgColor);
        console.log('Number of colors in the image: ' + colorCount);

        // Save each color data in the colors vector (for kmeans)
        var colors = [];
        var pixel;

        for (var i = 0; i < data.length; i += 4) {
          // Remove transparency and convert it to white color
          if (data[i+3] !== 255) {
            data[i] = 255;
            data[i+1] = 255;
            data[i+2] = 255;
            data[i+3] = 255;
          }

          // [r,g,b] values
          pixel = [data[i],data[i+1],data[i+2]];
          colors.push(pixel);
        }

        // Require kmeans lib
        var clusterfck = require("clusterfck");
        var extCentroids = null;

        // Override the centroids function so the
        //  centroids are not random and are
        //  always the same. Also we want to
        //  prioritize the most dominant colors.
        clusterfck.Kmeans.prototype.randomCentroids = function(points, k) {
          // Count the number of occurrences of each color
          var counts = {};
          for(var i = 0; i < points.length; i++) {
            var color = points[i];
            var num = (color[0] << 16) + (color[1] << 8) + color[2];
            counts[num] = counts[num] ? counts[num]+1 : 1;
          }

          // Sort the colors by occurrence
          var sortable = [];
          for (var c in counts) {
            sortable.push([c, counts[c]]);
          }

          sortable.sort(function(a, b) {
            // Sort descending
            return b[1] - a[1];
          });

          var centroids;
          if(sortable.length >= paper.ColorAmount){
            centroids = sortable.slice(0); // copy
            centroids = centroids.map(function (item) {
              var color = item[0];
              var r = (color >> 16) & 255;
              var g = (color >> 8) & 255;
              var b = color & 255;
              return [r, g, b];
            });

            extCentroids = centroids.slice(0, k);
            console.log('Chosen colors: ' + JSON.stringify(extCentroids));
            return extCentroids;
          }
          else {
            centroids = points.slice(0); // copy
            extCentroids = centroids.slice(0, k);
            console.log('Chosen colors: ' + JSON.stringify(extCentroids));
            return extCentroids;
          }
        };

        // Classify all pixels according to the kmeans result
        // Calculate clusters.
        var kmeans = new clusterfck.Kmeans();
        var clusters = kmeans.cluster(colors, paper.ColorAmount);

        // Compute color mapping
        paper.computeClosestColors(kmeans);

        // Create binary maps
        // Add each cluster as svg group
        // c is the current cluster level
        // Copy original data array to avoid loosing it in the for loop
        var binaryLayers = [];

        var dataCopy = new Uint8ClampedArray(data);

        // For each cluster
        for(var c = 0; c < clusters.length; c++) {

          // Data vector for the current layer
          var currentLayer = new Uint8ClampedArray(data.length);

          // Put data into the layer
          for (i = 0; i < data.length; i += 4) {

            // Original RGB value
            pixel = [dataCopy[i],dataCopy[i+1],dataCopy[i+2]];

            // Cluster index
            var clusterIndex = kmeans.classify(pixel);

            // If current pixel is classified as c
            if(clusterIndex === c)
            {
              currentLayer[i]     = 0; // Paint in white
              currentLayer[i + 1] = 0;
              currentLayer[i + 2] = 0;
              currentLayer[i + 3] = 255;
            }
            else {
              currentLayer[i]     = 255; // Paint in black
              currentLayer[i + 1] = 255;
              currentLayer[i + 2] = 255;
              currentLayer[i + 3] = 255;
            }
          }
          binaryLayers.push(currentLayer);
        }

        // Render loopLayers
        // First layer is always a square with image dims
        // paper.drawBackgroundSquare(canvas.width,canvas.height);

        // Draw all the others. If the detected background color is the same
        //  as the first color (ie most dominant) for the K-Means centroids
        //  then skip the first layer as it's the background
        if( floatsAreEqual(extCentroids[0][0], bgColor[0], 1) && 
            floatsAreEqual(extCentroids[0][1], bgColor[1], 1) &&
            floatsAreEqual(extCentroids[0][2], bgColor[2], 1)) {
          console.log('p=1');
          pos = 1;
        }
        else {
          console.log('p=0');
          pos = 0;
        }

        console.log(binaryLayers.length + " binary layers");
        loopLayersArray(binaryLayers, ctx, imageData, canvas, function (error) {
          if(error){
            console.error(error.stack);
            reject(error.message);
          }
          else {
            resolve();
          }
        });
      }
      catch (e){
        console.error(e.stack);
        reject(e.stack);
      }

    };
  });

  return promise;
};

// Called when the user click vector load again
paper.reloadImportedImage = function() {

  var promise = new Promise(function (resolve, reject) {
    // Reload into timeout to allow previous code to finish
    setTimeout(function() {
      if(paper.lastTracedGroup){
        var ref = paper.project.activeLayer.getItems(
            { data: { imageId: paper.lastTracedGroup }}
        )[0];
        var tracing = paper.getTracedImage(ref);
        _.each(tracing, function (compound) {
          compound.remove();
        });
      }

      paper.importForKmeans(paper.globalPath).then(function () {
        resolve();
      }).catch(function(e){
        reject(e);
      });
    }, 5000);
  });

  return promise;
};

function detectBackgroundColor(data, width, height, marginPercent){
  var margin = (marginPercent/100) * width;
  var colors = [];

  function pushPixel(data, i){
    // Remove transparency and convert it to white color
    if (data[i+3] !== 255) {
      colors.push([255, 255, 255]);
    }
    else {
      colors.push([data[i],data[i+1],data[i+2]]);
    }
  }

  // Iterate over all the pixels and get the colors from the image borders
  for(var i = 0; i < data.length; i += 4){
    var x = (i / 4) % width;
    var y = Math.floor((i / 4) / width);

    // Left side
    if(x < margin) {
      pushPixel(data, i);
    }
    // Right side
    else if(x > (width-margin)){
      pushPixel(data, i);
    }
    // Top side
    else if(y < margin) {
      pushPixel(data, i);
    }
    // Bottom side
    else if(y > (height-margin)){
      pushPixel(data, i);
    }
  }

  // Count the number of occurrences of each color
  var counts = {};
  for(i = 0; i < colors.length; i++) {
    var color = colors[i];
    var num = (color[0] << 16) + (color[1] << 8) + color[2];
    counts[num] = counts[num] ? counts[num]+1 : 1;
  }

  // Get the color with the maximum number of occurrences
  var sortable = [];
  for (var c in counts) {
    sortable.push([c, counts[c]]);
  }

  sortable.sort(function(a, b) {
    // Sort descending
    return b[1] - a[1];
  });

  var bgColor = sortable[0][0];
  var r = (bgColor >> 16) & 255;
  var g = (bgColor >> 8) & 255;
  var b = bgColor & 255;

  // Return the color with most occurrences
  return [sortable.length, [r, g, b]];
}

// Centers all the svg layers
paper.centerAndCutImportedSVG = function() {

  // Center layers
  // Group the to apply global transformations (position-scale)
  var group = new Group({
    children: paper.ImportedSVGLayers,
    position: view.center
  });

  // Compute the group bounds according to their children because
  //  group.bounds returns bad values sometimes
  function computeGroupBounds(group) {
    var width = 0, height = 0;
    _.each(group.children, function (child) {
      width = Math.max(width, child.bounds.width);
      height = Math.max(height, child.bounds.height);
    });

    return {width: width, height: height};
  }

  // Size the Group down
  var bounds = computeGroupBounds(group);
  var scale = {
    x: (view.bounds.width * 0.8) / bounds.width,
    y: (view.bounds.height * 0.8) / bounds.height
  };

  group.pInitialBounds = bounds;
  console.log('Initial bounds - Width: ' + group.pInitialBounds.width +
      ' - Height: ' + group.pInitialBounds.height);

  // Use the smallest scale
  scale = (scale.x < scale.y ? scale.x : scale.y);
  group.scale(scale);

  bounds = computeGroupBounds(group);
  console.log('Final bounds - Width: ' + bounds.width +
      ' - Height: ' + bounds.height);

  // Cuts the background layer to avoid overlapping
  // var backgroundPaths =  paper.ImportedSVGLayers
  //     [0].getItems({ class: PathItem });
  // var backgroundSquare = backgroundPaths[0];

  // First, make all paths closed to make substract() to work
  for (var i = 0; i <  paper.ImportedSVGLayers.length; i++) {

    // Get all the paths from the svg
    var pathItems = paper.ImportedSVGLayers[i].getItems({ class: PathItem });

    for (var j = 0; j < pathItems.length; j++)
    {
      // Get path item
      var currentItem = pathItems[j];

      // Make it closed
      currentItem.closed = true;

      // Make it Polygonal
      currentItem.data.isPolygonal = true;
      currentItem.name = "traced path";
    }
  }

  // // Now, perform the background cutting
  // for (i = 1; i <  paper.ImportedSVGLayers.length; i++) {
  //   // First children is always the compound path of the whole layer
  //   var tempBackground =
  //       backgroundSquare.subtract(paper.ImportedSVGLayers[i].children[0]);
  //   tempBackground.data = { color: backgroundSquare.data.color };

  //   backgroundSquare.remove();
  //   backgroundSquare = tempBackground;
  // }

  // // Update the background layer in the Imported SVG Layers list
  // paper.ImportedSVGLayers[0] = backgroundSquare;

  // // Debug
  // var origGroup = group.clone().translate(new Point(400, 0));
  // origGroup.name = 'debug';
  // origGroup.rasterize();
  // origGroup.remove();

  // Ungroup all items, filter groups that already existed before the tracing
  var groups = project.activeLayer.getItems({ class: Group,
    id: function (id) {
      return paper.existingIDs.indexOf(id) < 0;
    }
  });
  var paths;
  for (i = 0; i <  groups.length; i++) {
    group = groups[i];

    // Make sure the paths inside the group matches the group color
    paths = group.getItems({ class: PathItem });
    for(var n = 0; n < paths.length; ++n){
      paths[n].data = { color: group.data.color };
      paths[n].name = group.name;
    }

    group.parent.insertChildren(group.index, group.removeChildren());
    group.remove();
  }

  // Make them closed
  paths = project.activeLayer.getItems({ class: PathItem,
    id: function (id) {
      return paper.existingIDs.indexOf(id) < 0;
    }
  });
  for (i = 0; i <  paths.length; i++) {
    var path = paths[i];
    path.closed = true;
    path.data.fill = true;
    path.name = "traced path";
  }

  // Remove paths with small areas
  _.each(paths, function (path) {
    var area = Math.abs(path.area);
    // Remove if to small
    if(area < paper.cleanParameter)
    {
      path.remove();
      console.log('Removed path ' + path.id + ' due to small area');
    }
  });

  // Create group with all the paths corresponding to this
  //  traced image
  var items = project.activeLayer.getItems({ class: paper.PathItem,
    id: function (id) {
      return paper.existingIDs.indexOf(id) < 0;
    }
  });

  var imageId = paper.getRandomInt(0, 10000);
  paper.lastTracedGroup = imageId;

  // Set the imageId for this compounds so we know we should treat
  //  them as a single item, we can't put them on a Group because
  //  that will override the colors
  _.each(items, function (item) {
    if(item instanceof paper.CompoundPath ||
      (item.parent && !(item.parent instanceof paper.Layer))) {
      item.name = 'traced path';
      item.data.imageId = imageId;
    }
    else {
      var c = new paper.CompoundPath({
        children: [item],
        fillColor: item.fillColor,
        data: item.data,
        name: 'traced path'
      });
      c.data.imageId = imageId;
    }
  });

  // Select the new SVG and disable other selections
  var compounds = project.activeLayer.getItems({ class: paper.CompoundPath,
    id: function (id) {
      return paper.existingIDs.indexOf(id) < 0;
    }
  });
  _.each(compounds, function (compound) {
    compound.applyMatrix = true;
  });
  toolSelect.selectNewSvg(compounds);

  // Update view
  paper.view.update();

  // Clean lists
  paper.ImportedSVGLayers = []; // SVG Layers
  paper.ColorMapping = []; // Color Mapping
  console.log('Finished tracing');
};

paper.getRandomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

function floatsAreEqual(a1, a2, epsilon){
  return Math.abs(a1 - a2) < epsilon;
}

// Process one layer at a time. Basically vectorizing with Potrace and loading
// into paper.js
function processLayer(layer,ctx,imageData,canvas,callback) {

  // New imageData
  var newImageData = ctx.createImageData(imageData.width,
      imageData.height); // width x height

  // Copy data
  for (var i = 0; i < layer.length; i += 1) {
    newImageData.data[i] = layer[i];
  }

  // Overwrite original data
  ctx.putImageData(newImageData, 0, 0);
  var gh = canvas.toDataURL('image/png');

  // Uncomment for debugging
  //paper.savePNG(gh);

  // Vectorize using potrace
  Potrace.loadImageFromUrl(gh);

  // Set parameters
  //Potrace.setParameter({turdsize: 10, alphamax: 10, opttolerance: 0.6});

  Potrace.process(function(){

    // For debugging, save svg to file
    // paper.saveSVG();

    // Get SVG
    var svg = Potrace.getSVG(1);

    // Load SVG in paperjs
    paper.importSvg(svg,false,pos);

    // Wait import svg to finish
    setTimeout(function() {
      callback();
    },1000);

  }.bind(this));
}

// Saves a given Raster Image (gh) to disk
paper.savePNG = function(gh) {
  // For debugging
  // Save Kmeans result
  var a  = document.createElement('a');
  a.href = gh;
  a.download = '';
  a.click();
};

// Saves the Potrace image to disk
paper.saveSVG = function() {
  var text = Potrace.getSVG(1);
  var filename = "vectorized.svg";
  var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
  saveAs(blob, filename);
};

// Smoothes the paths. it also removes small segmentes if necesary.
// It uses Simplify paths from paper.js
paper.smoothSVG = function(svg) {

  // Get all the paths from th svg
  var items = svg.getItems({ class: PathItem });

  // Iterate over them
  for (var i = 0; i < items.length; i++) {

    // Get item
    var child =  items[i];

    // If Path (no compoundPath)
    if(child.className === 'Path'){
      if(paper.EdgeFidelity > 1)
      {
        // Simplify. paper.js code is buggy for this function
        child.simplify(paper.EdgeFidelity);
      }
    }
  }
};

// First layer is always a plain square. This method creates it.
paper.drawBackgroundSquare = function(width,height){

  // Define rectangle
  var rectangle = new Rectangle(new Point(0, 0), new Point(width, height));
  var path = new Path.Rectangle(rectangle);

  // Base color
  var initColor = paper.pancakeShades[ paper.ColorMapping[0] ];
  var group = new Group({
    children: [path],
    // Use darkest color
    //strokeColor: initColor,
    fillColor:  initColor,
    //strokeWidth: paper.strokeWidth,
    // Move the group to the center of the view:
    //position: view.center
  });
  group.data.color = paper.ColorMapping[0];
  group.name = "background";

  // Assign the color to every element inside the group
  var paths = group.getItems({});
  for (var i = 0; i <  paths.length; i++) {
    paths[i].data = { color: paper.ColorMapping[0] };
  }

  paper.ImportedSVGLayers.push(group);
};

// Actually does the SVG importing
paper.importSvg = function(filePath, isFilePath, colorI) {

  // File content
  var contents;

  // If a path is given..
  if(isFilePath)
  {
    // Read svg file first
    contents = fs.readFileSync(filePath, 'utf8');
  }
  else
  {
    // Else, just copy content
    contents = filePath;
  }

  // Import svg into Paper.js
  var svg = project.importSVG(contents, {expandShapes: true,
    applyMatrix: false});

  //var colorIndex = paper.pancakeShades.length - colorI;
  var initColor = paper.pancakeShades[ paper.ColorMapping[colorI] ];

  // Set initial SVG color
  selectColor(paper.pancakeCurrentShade);

  // Smooth svg
  paper.smoothSVG(svg);

  // Group the to apply global transformations (position-scale)
  var group = new Group({
    children: [svg],
    // Use darkest color
    //strokeColor: initColor,
    fillColor:  initColor,
    //strokeWidth: paper.strokeWidth,
    // Move the group to the center of the view:
    //position: view.center
  });
  group.data = { color: paper.ColorMapping[colorI] };
  group.name = "msvg";

  // Assign the color to every element inside the group
  var paths = group.getItems({});
  for (var i = 0; i <  paths.length; i++) {
    paths[i].data = { color: paper.ColorMapping[colorI] };
  }

  // Keep track of the group
  paper.ImportedSVGLayers.push(group);

  //// Make SVG single layered
  //// Get only Paths
  //var paths = project.getItems({ class: PathItem });

  // // Add them back
  // project.activeLayer.addChildren(paths);
  //
  // // Remove groups (empty)
  // for (var i = 0; i < project.activeLayer.children.length; i++) {
  //   var child =  project.activeLayer.children[i];
  //   if(child.className !== 'Path')
  //   {
  //     // Remove if group
  //     project.activeLayer.removeChildren(i,i+1);
  //     i = i-1;
  //   }
  //   else if(child.className === 'Path')
  //   {
  //     // Set Paths as Polygonal lines
  //     child.data.isPolygonal = true;
  //
  //     // Check if filled and refill using floodfill
  //     if(child.fillColor !== null)
  //     {
  //       child.strokeColor = paper.pancakeShades[paper.pancakeCurrentShade];
  //       //child.fillColor = paper.pancakeShades[paper.pancakeCurrentShade];
  //       //toolFill.fillThePath(child.interiorPoint);
  //     }
  //   }
  // }
};

// Clear and init the variables used for Image Tracing
paper.clearImageTracing = function () {
  paper.ImportedSVGLayers = []; // SVG Layers
  paper.ColorMapping = []; // Color Mapping
  paper.globalPath = undefined;
};

// Editor should be done loading, trigger loadInit
editorLoadedInit();
