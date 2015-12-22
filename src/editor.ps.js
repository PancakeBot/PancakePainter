/*
 * @file This PaperScript file controls the main PancakePainter SVG Editor and
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

// TODO: Load all tools in folder based on weight
var toolPen = require('./tools/tool.pen')(paper);
var toolFill = require('./tools/tool.fill')(paper);
var toolSelect = require('./tools/tool.select')(paper);

var $editor = $('#editor');
paper.setCursor = function(type) {
  // TODO: Implement cursor change on hover of handles, objects, etc
  //if (!type) type = 'default';
  //$editor.css('cursor', type);
}

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
        { name: i18n.t('import.files'), extensions: ['jpg', 'jpeg', 'gif', 'png', 'svg'] }
      ]
    }, function(filePath){
      if (!filePath) {  // Open cancelled
        paper.finishImageImport();
        return;
      }

      var path = filePath[0];
      // check the file type
      if((/\.svg$/i).test(path)) {
          paper.importSvg(path);
      } else {
          paper.importImage(path);
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
        }

        paper.traceImage.pInitialBounds = this.bounds;

        // Use the smallest scale
        scale = (scale.x < scale.y ? scale.x : scale.y);
        paper.traceImage.scale(scale);

        paper.traceImage.opacity = 0.5;

        // Select the thing and disable other selections
        toolSelect.imageTraceMode(true);
    }
};

// actually does the SVG importing
paper.importSvg = function(filePath) {
    var contents = fs.readFileSync(filePath, 'utf8');
    var svg = project.importSVG(contents, {expandShapes: false, applyMatrix: false});
    var bounds = svg.bounds;
    var colorIndex = paper.pancakeShades.length - 1;
    var initColor = paper.pancakeShades[colorIndex];
    // set initial SVG color
    selectColor(colorIndex);
    var group = new Group({
        children: [svg],
        // Use darkest color
        strokeColor: initColor,
        fillColor: initColor,
        // Move the group to the center of the view:
        position: view.center
    });
    // Size the SVG down
    var scale = {
        x: (view.bounds.width * 0.8) / bounds.width,
        y: (view.bounds.height * 0.8) / bounds.height
    };
    group.pInitialBounds = group.bounds;
    // Use the smallest scale
    scale = (scale.x < scale.y ? scale.x : scale.y);
    group.scale(scale);
    // Select the new SVG and disable other selections
    toolSelect.selectNewSvg(group);
};

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
  return project.exportJSON();
}

// Called whenever the file is changed from a tool
paper.fileChanged = function() {
  currentFile.changed = true;
}

// Stopgap till https://github.com/paperjs/paper.js/issues/801 is resolved.
// Clean a path of duplicated segment points, triggered on change/create
paper.cleanPath = function(path){
  _.each(path.segments, function(seg, index){
    if (index > 0 && typeof path.segments[index-1] !== 'undefined' && seg) {
      var lastP = path.segments[index-1].point;
      if (lastP.x === seg.point.x && lastP.y === seg.point.y) {
        // Duplicate point found, remove it.
        seg.remove();
      }
    }
  });
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

  // Reinstate traceImage, if any.
  if (paper.imageLayer.children.length) {
    paper.traceImage = paper.imageLayer.children[0];
    paper.traceImage.img = paper.traceImage.children[0];
  }

  toastr.info(i18n.t('file.opened', {file: currentFile.name}));
  view.update();
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
    size: [p.bounds.width + p.bounds.width/Math.PI , p.bounds.height + p.bounds.height/Math.PI]
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
  destination = boundPath.getPointAt(pos * amt);

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

    for (var i = 1; i < lines[g].length; i++) {
      // Don't join lines that cross outside the path
      var v = new Path({
        segments: [l.lastSegment.point, lines[g][i].firstSegment.point]
      });


      // Find a point halfway between where these lines would be connected
      // If it's not within the path, don't do it!
      if (!p.contains(v.getPointAt(v.length/2)) || v.getIntersections(p).length > 3) {
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
}

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
