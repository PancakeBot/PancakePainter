/**
 * @file Tool definition for the PC dual purpose drawing tool. Provides event
 * handlers and special logic for the drawing tool ONLY.
 **/
"use strict";

module.exports = function(paper) {
  // Init Tool (to be handed back)
  var tool = new paper.Tool();

  // Constant tool tweaks
  var endSnapDistance = 10;
  var minLineLength = 8;
  var simplifyAmount = 3;
  var simplifyThreshold = 150; // Smallest shape that will be simplified

  // Paper global extenders
  var Path = paper.Path;

  // Handy internal vars
  var drawPath = null;
  var polygonalDraw = false;
  var pencilDraw = false;
  var bandLine = null;
  var endSnap = null;

  // Tool identification (for building out tool palette)
  tool.name = 'tools.pen';
  tool.key = 'pen';
  tool.cursorOffset = '1 31'; // Position for cursor point
  tool.cursorColors = true; // Different icons/cursor for each color?

  // Catch when undo is being changed, and kill it/augment it depending.
  tool.undoSet = function(op) {
    if (pencilDraw && drawPath) return false;

    if (polygonalDraw) {
      if (op === 'undo' && drawPath.segments.length > 1) {
        drawPath.segments.pop();
        bandLine.segments[0].point = drawPath.lastSegment.point;
        paper.view.update();
      }
      return false;
    }

    return true;
  };

  tool.onMouseDown = function(event) {
    // Continue drawing polygonal (ignores hitTest while on)
    if (drawPath && polygonalDraw) {
      if (event.event.button === 0) drawPath.add(event.point);

      // Shortcut single click end polygon draw shape via path closing, or
      // right click
      if (drawPath.segments.length > 2 && checkEndSnap(event.point) || event.event.button === 2) {
        polygonDrawComplete();
        return;
      }

      // Make a new point, delete the first one
      bandLine.segments[0].point = event.point;
      return;
    }

    // Create a new drawPath and set its stroke color
    if (event.event.button === 0) {
      pencilDraw = true;
      drawPath = newBatterPath(event.point);

      // Set position of endSnap notifier
      initEndSnap(event.point);
    }

  };

  tool.onMouseDrag = function(event) {
    // While the user drags the mouse, points are added to the drawPath at the
    // position of the mouse event
    if (drawPath && !polygonalDraw && pencilDraw) {
      drawPath.add(event.point);
      if (drawPath.length > endSnapDistance + 5) checkEndSnap(event.point);
    }
  };

  tool.onMouseMove = function(event) {
    if (drawPath && polygonalDraw) {
      // Move the rubber band to the point if polygonal
      bandLine.segments[1].point = event.point;

      if (drawPath.segments.length > 2) checkEndSnap(event.point);
    }
  };

  tool.onMouseUp = function(event) {
    if (drawPath) {
      if (drawPath.length <= minLineLength && event.event.button === 0) {
        // Restart the path
        drawPath.remove();
        drawPath = newBatterPath(event.point);

        polygonalDraw = true;
        pencilDraw = false;
        bandLine = new Path({
          segments: [event.point, event.point],
          strokeColor: 'red',
          strokeWidth: paper.strokeWidth,
          dashArray: [10, 4]
        });

        drawPath.onDoubleClick = function(){
          // Remove the last segment (from the first click of the double)
          drawPath.segments.pop();
          polygonDrawComplete();
        };
        paper.setCursor('copy');
      }


      // Freehand pencil draw complete
      if (!polygonalDraw && pencilDraw && event.event.button === 0) {
        // When the mouse is released, simplify it (if it's not too small):
        if (drawPath.length > simplifyThreshold) {
          drawPath.simplify(simplifyAmount);
        } else {
          drawPath.simplify(1);
        }

        // If the distance is right and we have end snap... make it closed!
        if (drawPath.length > endSnapDistance + 5 && checkEndSnap(drawPath.lastSegment.point)) {
          drawPath.lastSegment.remove();
          drawPath.closed = true;
        }

        pencilDraw = false;

        // Select the drawPath, so we can see its segments:
        drawPath = null;
        clearEndSnap();

        paper.fileChanged();
      }

    }
  };

  tool.onKeyDown = function (event) {
    if (_.contains(['escape', 'enter'], event.key)) {
      polygonDrawComplete();
    }
  };

  tool.polygonDrawComplete = polygonDrawComplete;
  function polygonDrawComplete() {
    if (polygonalDraw) {
      polygonalDraw = false;

      // If the distance is right and we have end snap... make it closed!
      if (drawPath.segments.length > 2 && checkEndSnap(drawPath.lastSegment.point)) {
        drawPath.lastSegment.remove();
        drawPath.closed = true;
      }


      bandLine.remove();
      bandLine = null;
      paper.setCursor();
      clearEndSnap();

      // Remove orphan node paths
      if (drawPath.segments.length === 1) {
        drawPath.remove();
      } else {
        drawPath.data.isPolygonal = true;
        paper.cleanPath(drawPath);
        paper.fileChanged();
      }

      drawPath = null;
    }
  }

  function newBatterPath(point) {
    return new Path({
      segments: [point],
      strokeColor: paper.pancakeShades[paper.pancakeCurrentShade],
      strokeWidth: paper.strokeWidth,
      strokeCap: 'round',
      miterLimit: 1,
      data: {color: paper.pancakeCurrentShade}
    });
  }

  // Initialize the endSnap notifier and position
  function initEndSnap(point) {
    endSnap = new Path.Circle({
      center: point,
      radius: endSnapDistance,
      strokeWidth: 0,
      strokeColor: '#00FF00'
    });
  }

  // Check to see if we're within the end snapping threshold
  function checkEndSnap(point) {
    if (!endSnap) return false;

    // Above a certain number of segments, highlight an end fill snap
    var vector = point.subtract(endSnap.position);

    if (vector.length <= endSnapDistance) {
      endSnap.strokeWidth = 3;
      return true;
    } else {
      endSnap.strokeWidth = 0;
      return false;
    }
  }

  // Clean up the endSnap path
  function clearEndSnap() {
    endSnap.remove();
    endSnap = null;
  }

  return tool;
};
