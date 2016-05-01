/*
 * @file This PaperScript file controls the main PancakePainter SVG Editor and
 * all importing/exporting of its data.
 */
 /* globals
   window, mainWindow, $, _, toastr, i18n, paper, view, project, scale,
   Raster, Group, Point, Path, Layer, dataURI, currentFile, path, fs,
   editorLoadedInit
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
_.each(paper.pancakeShades, function(color, index){ /* jshint unused:false */
  paper.pancakeShadeNames.push(i18n.t('color.color' + index));
});

paper.pancakeCurrentShade = 0;

// TODO: Load all tools in folder based on weight
var toolPen = require('./tools/tool.pen')(paper);
var toolFill = require('./tools/tool.fill')(paper);
var toolSelect = require('./tools/tool.select')(paper);

// Load Helpers
paper.undo = require('./helpers/helper.undo')(paper);
paper.clipboard = require('./helpers/helper.clipboard')(paper);

var $editor = $('#editor');
paper.setCursor = function(type) {
  // TODO: Implement cursor change on hover of handles, objects, etc
  if (!type) type = 'default';
  //$editor.css('cursor', type);
};

function onResize(event) {
  // Ensure paper project view retains correct scaling and position.
  view.zoom = scale;
  var corner = view.viewToProject(new Point(0,0));
  view.scrollBy(new Point(0,0).subtract(corner));
}

// Initialize (or edit) an image import for tracing on top of
paper.initImageImport = function() {
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
        // The raster MUST be in a group to alleviate coord & scaling issues.
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
    });
  } else {
    // Select the thing and disable other selections
    toolSelect.imageTraceMode(true);
  }

  view.update();
};

// Called when completing image import management
paper.finishImageImport = function() {
  window.activateToolItem('#tool-pen');
  toolPen.activate();
  toolSelect.imageTraceMode(false);
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

  paper.imageLayer = project.layers[0];
  paper.mainLayer = project.layers[1];

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


// Editor should be done loading, trigger loadInit
editorLoadedInit();
