/*
 * @file This PaperScript file controls the paper instance running in a webview
 * for simulation/generation of GCODE from imported Paper.JS JSON exported from
 * a single givend rawing layer.
 */
 /* globals
   window, paper, Layer, view, Path, Point
 */
var $ = window.$ = require('jquery');
var _ = window._ = require('underscore');
var gcRender = require('../gcode.js')(); // GCODE renderer.
var ipc = window.ipc = require('electron').ipcRenderer;
var remote = require('electron').remote;
var app = window.app = remote.app;

var currentShade = 3;
var ac = app.constants;
var printArea = { // Default Print area limitations (in MM)
  x: ac.printableArea.offset.right,
  y: ac.printableArea.height,
  l: ac.printableArea.offset.left + ac.printableArea.width,
  t: 0
};

/*
      ██ ██████   ██████      ██████  ██████  ███    ███ ███    ███ ███████
      ██ ██   ██ ██          ██      ██    ██ ████  ████ ████  ████ ██
      ██ ██████  ██          ██      ██    ██ ██ ████ ██ ██ ████ ██ ███████
      ██ ██      ██          ██      ██    ██ ██  ██  ██ ██  ██  ██      ██
      ██ ██       ██████      ██████  ██████  ██      ██ ██      ██ ███████
Interprocess communication and handlers between the main app and this process ==
==============================================================================*/
ipc.on('loadInit', function(event, jsonData) { /* jshint ignore:line */
  paper.sourceLayer.removeChildren();
  paper.sourceLayer.importJSON(jsonData);
  ipc.sendToHost('initLoaded');
});

ipc.on('renderTrigger', function(event, config) { /* jshint ignore:line */
  var gcode = gcRender(paper.sourceLayer, config);
  paper.simulateGCODE(gcode);
  ipc.sendToHost('renderComplete', gcode);
});

ipc.on('cleanup', function() {
  paper.cleanup();
});

$(window).on('resize', function() {
  var s = {w:762, h:465};
  var w = {w: $(this).width(), h: $(this).height()};

  // Use the smallest scale.
  var scale = {x: w.w / s.w,  y: w.h / s.h};
  scale = (scale.x < scale.y ? scale.x : scale.y);

  $('div#simulator-wrapper').css('transform', 'translate(-50%, -52%) scale(' + scale + ')');
});

// Setup layers ================================================================
// =============================================================================
paper.shadeLayers = [new Layer(), new Layer(), new Layer(), new Layer()];
paper.shadeLayers.empty = function() {
  _.each(this, function(layer) {
    layer.removeChildren();
  });
};

paper.sourceLayer = new Layer();
paper.sourceLayer.visible = false;

paper.cleanup = function() {
  paper.shadeLayers.empty();
  paper.sourceLayer.removeChildren();
};

// UTIL FUNCTIONS ==============================================================
// =============================================================================
paper.simulateGCODE = function(gcodeData) {
  // Prep the shade order/layer.
  currentShade = 3; // Start at darkest.
  paper.shadeLayers.empty();
  paper.shadeLayers[currentShade].activate();

  // Draw all the GCODE into paths.
  gcodeData = gcodeData.split("\n");
  _.each(gcodeData, function(line) {
    drawCodeLine(line);
  });

  // If currentShade isn't 0, remap the preview colors to match color order.
  if (currentShade !== 0) {
    var maxShades = (3 - currentShade) + 1;
    for (var i = 0; i <= maxShades; i++) {
      paper.shadeLayers[3 - i].strokeColor = app.constants.pancakeShades[i];
    }
  }
};

// Convert an input PancakeBot coordinate to an output Paper.JS mapped coord.
function reMap(p) {
  var b = view.bounds;
  return new Point({
    x: map(p.x, printArea.l, printArea.x, b.x, b.width),
    y: map(p.y, printArea.t, printArea.y, b.y, b.height)
  });
}

// Map a value in a given range to a new range
function map(x, inMin, inMax, outMin, outMax) {
  return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

var lastP;
var preview = {};
function drawCodeLine(line) {
  // Split by comments to remove them, trimmed, upercased then split by space
  line = line.split(';')[0].trim();
  line = line.toUpperCase().split(' ');

  // Shift off the first element as the code, the rest are arguments
  var code = line.shift();

  // Parse arguments into an object.
  var args = {};
  _.each(line, function(arg) {
    args[arg[0].toLowerCase()] = parseFloat(arg.substr(1));
  });

  switch (code) {
    case 'M106': // Pump ON
      preview = new Path({
        strokeWidth: 4,
        strokeColor: app.constants.pancakeShades[currentShade],
        strokeCap: 'round',
        strokeJoin: 'round',
      });
      if (lastP) preview.add(lastP);
      break;
    case 'M107': // Pump OFF
      preview = null;
      break;
    case 'G1': // Movement speed
      break;
    case 'G4': // Pause/Motors Off
      break;
    case 'M142': // Bottle change/color change timer
      currentShade--;
      paper.shadeLayers[currentShade].activate();
      break;
    case 'G00': // X Y Move
      // Only draw move point if pump is on and there's a point passed to G1
      if (args.x) {
        var p = reMap(args);
        lastP = reMap(args);
        if (preview) preview.add(p);
      }

      break;
    case 'W1': // Workspace Setup
      printArea = args;
      break;
    case 'G28': // Park to 0,0
      break;
    default: // We can ignore these: G21, G90, etc
  }
}


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

$(window).resize();

// Paper should be loaded :)
ipc.sendToHost('paperReady');
