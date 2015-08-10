/**
 * @file Tool definition for the PC dual purpose drawing tool. Provides event
 * handlers and special logic for the drawing tool ONLY.
 **/
"use strict";

module.exports = function(paper) {
  // Init Tool (to be handed back)
  var tool = new paper.Tool();

  // Paper global extenders
  var Path = paper.Path;

  // Handy internal vars
  var drawPath = null;
  var polygonalDraw = false;
  var pencilDraw = false;
  var bandLine = null;

  // Tool identification (for building out tool palette)
  tool.name = 'tools.pen';
  tool.key = 'pen';

  tool.onMouseDown = function(event) {
    // Continue drawing polygonal (ignores hitTest while on)
    if (drawPath && polygonalDraw) {
      drawPath.add(event.point);

      // Make a new point, delete the first one
      bandLine.segments[0].point = event.point;
      return;
    }

    // Create a new drawPath and set its stroke color
    pencilDraw = true;
    drawPath = new Path({
      segments: [event.point],
      strokeColor: paper.pancakeShades[paper.pancakeCurrentShade],
      strokeWidth: paper.strokeWidth,
      data: {color: paper.pancakeCurrentShade}
    });

  };

  tool.onMouseDrag = function(event) {
    // While the user drags the mouse, points are added to the drawPath at the
    // position of the mouse event
    if (drawPath && !polygonalDraw && pencilDraw) {
      drawPath.add(event.point);
    }
  };

  tool.onMouseMove = function(event) {
    if (drawPath && polygonalDraw) {
      bandLine.segments[1].point = event.point;
    }
  };

  tool.onMouseUp = function(event) {
    if (drawPath) {
      if (drawPath.length === 0) {
        polygonalDraw = true;
        pencilDraw = false;
        bandLine = new Path({
          segments: [event.point, event.point],
          strokeColor: 'red',
          strokeWidth: paper.strokeWidth,
          dashArray: [10, 4]
        });
        bandLine.onDoubleClick = function(){
          // Remove the last segment (from the first click of the double)
          drawPath.segments.pop();
          polygonDrawComplete();
        };
        paper.setCursor('copy');
      }

      if (!polygonalDraw && pencilDraw) {
        // When the mouse is released, simplify it:
        drawPath.simplify(10);

        pencilDraw = false;

        // Select the drawPath, so we can see its segments:
        drawPath = null;
      }
    }
  };

  tool.onKeyDown = function (event) {
    if (_.contains(['escape', 'enter'], event.key)) {
      polygonDrawComplete();
    }
  };

  function polygonDrawComplete() {
    if (polygonalDraw) {
      polygonalDraw = false;

      // Remove orphan node paths
      if (drawPath.segments.length === 1) {
        drawPath.remove();
      } else {
        drawPath.data.isPolygonal = true;
      }

      drawPath = null;
      bandLine.remove();
      bandLine = null;
      paper.setCursor();
    }
  }

  return tool;
};

