/**
 * @file Tool definition for the PC dual purpose selection tool. Provides event
 * handlers and special logic for the selection tool ONLY. Allows selection of
 * entire objects, rotation, scaling and node/segment adjustment.
 **/
"use strict";

module.exports = function(paper) {
  var tool = new paper.Tool();

  // Paper global extenders
  var Path = paper.Path;
  var Point = paper.Point;
  var Rectangle = paper.Rectangle;
  var project = paper.project;

  // Handy internal vars
  paper.selectRect = null;
  var selectionRectangleScale = null;
  var selectionRectangleRotation = null;
  var segment, path;
  paper.imageTraceMode = false;
  var hitOptions = {
    segments: true,
    stroke: true,
    fill: true,
    tolerance: 5
  };

  // Externalize deseletion
  paper.deselect = function() {
    if (paper.selectRect) {
      paper.selectRect.remove();
      paper.selectRect = null;

      // Complete imageTraceMode if we're deselecting.
      if (paper.imageTraceMode) {
        paper.finishImageImport();
      }
    }
  };

  // Tool identification (for building out tool palette)
  tool.name = 'tools.select';
  tool.key = 'select';
  tool.cursorOffset = '1 1'; // Position for cursor point

  tool.onMouseDown = function(event) {
    segment = path = null;

    var hitResult = project.hitTest(event.point, hitOptions);

    // Don't select image if not in trace mode
    if (hitResult && !paper.imageTraceMode) {
      if (paper.traceImage) {
        if (hitResult.item == paper.traceImage
                || hitResult.item == paper.traceImage.img) {
          hitResult = null; // Act like we didn't hit anything
        }
      }
    }

    // If we didn't hit anything with hitTest...
    if (!hitResult) {
      // Finish imageTraceMode
      if (paper.imageTraceMode) {
        paper.deselect();
        return;
      }

      // Find any items that are Paths (not layers) that contain the point
      var item = getBoundSelection(event.point);

      // If we actually found something, fake a fill hitResult
      if (item) {
        hitResult = {
          type: 'fill', // SURE it is ;)
          item: item
        };
      } else {
        // Deselect if nothing clicked (feels natural for deselection)
        if (paper.selectRect !== null) {
          paper.deselect();
        }

        return;
      }
    }

    if (event.modifiers.shift) {
      if (hitResult.type === 'segment') {
        hitResult.segment.remove();
      }
      return;
    }

    if (hitResult) {
      if (paper.imageTraceMode) {

        // Select the group, not the image
        if (hitResult.item == paper.traceImage.img) {
          hitResult.item = paper.traceImage;
        }

        //console.log('HITRESULT', hitResult.item);

        // Don't select any other items if in image trace mode
        if (hitResult.item != paper.selectRect && hitResult.item != paper.traceImage) {
          return;
        }
      }

      path = hitResult.item;

      if (hitResult.type === 'segment') {
        if (paper.selectRect !== null && path.name === "selection rectangle") {
          if (hitResult.segment.index >= 2 && hitResult.segment.index <= 4) {
            // Rotation hitbox
            selectionRectangleRotation = 0;
          } else {
            // Scale hitbox
            selectionRectangleScale = event.point.subtract(paper.selectRect.bounds.center).length / path.scaling.x;
          }
        } else {
          segment = hitResult.segment;
        }
      } else if (hitResult.type === 'stroke' && path !== paper.selectRect) {
        var location = hitResult.location;
        segment = path.insert(location.index + 1, event.point);
        //path.smooth();
      }

      if ((paper.selectRect === null || paper.selectRect.ppath !== path) && paper.selectRect !== path) {
        initSelectionRectangle(path);
      }
    }

    // If a fill hit, move the path
    if (hitResult.type === 'fill') {
      project.activeLayer.addChild(hitResult.item);
    }
  };

  tool.onMouseDrag = function(event) {
    if (selectionRectangleScale !== null) {
      // Path scale adjustment
      var ratio = event.point.subtract(paper.selectRect.bounds.center).length / selectionRectangleScale;
      var scaling = new Point(ratio, ratio);
      paper.selectRect.scaling = scaling;
      paper.selectRect.ppath.scaling = scaling;
      return;
    } else if (selectionRectangleRotation !== null) {
      // Path rotation adjustment
      var rotation = event.point.subtract(paper.selectRect.pivot).angle + 90;
      paper.selectRect.ppath.rotation = rotation;
      paper.selectRect.rotation = rotation;
      return;
    }

    if (segment && !paper.imageTraceMode) {
      // Individual path segment position adjustment
      segment.point.x += event.delta.x;
      segment.point.y += event.delta.y;

      // Smooth -only- non-polygonal paths
      //if (!path.data.isPolygonal) path.smooth();

      initSelectionRectangle(path);
    } else if (path) {
      // Path translate position adjustment
      if (path !== paper.selectRect) {
        path.position.x += event.delta.x;
        path.position.y += event.delta.y;
        paper.selectRect.position.x += event.delta.x;
        paper.selectRect.position.y += event.delta.y;
      } else {
        paper.selectRect.position = paper.selectRect.position.add(event.delta);
        paper.selectRect.ppath.position = paper.selectRect.ppath.position.add(event.delta);
      }
    }
  };

  tool.onMouseMove = function(event) {
    project.activeLayer.selected = false;

    if (paper.selectRect) {
      paper.selectRect.selected = true;
    }

    if (paper.imageTraceMode) {
      return; // No hover events for imageTraceMode
    } else {
      // No hover events for the trace image
      if (paper.traceImage) {
        if (event.item == paper.traceImage) return;
        if (event.item == paper.traceImage.img) return;
      }
    }


    var boundItem = getBoundSelection(event.point);

    if (event.item) {
      event.item.selected = true;
      paper.setCursor('copy');
    } else if (boundItem) {
      boundItem.selected = true;
      paper.setCursor('move');
    } else {
      paper.setCursor();
    }
  };

  tool.onMouseUp = function(event) {
    selectionRectangleScale = null;
    selectionRectangleRotation = null;

    // If we have a mouse up with either of these, the file has changed!
    if (path || segment) paper.fileChanged();
  };

  tool.onKeyDown = function (event) {
    if (paper.selectRect) {
      // Delete a selected path
      if (event.key === 'delete' || event.key === 'backspace') {
        paper.selectRect.ppath.remove();
        if (paper.imageTraceMode) paper.traceImage = null;
        paper.deselect();
      }

      // Deselect
      if (event.key === 'escape') {
        paper.selectRect.ppath.fullySelected = false;
        paper.deselect();
      }

    }
  };

  function initSelectionRectangle(path) {
    if (paper.selectRect !== null) paper.selectRect.remove();
    var reset = path.rotation === 0 && path.scaling.x === 1 && path.scaling.y === 1;
    var bounds;

    if (reset) {
      // Actually reset bounding box
      bounds = path.bounds;
      path.pInitialBounds = path.bounds;
    } else {
      // No bounding box reset
      bounds = path.pInitialBounds;
    }

    var b = bounds.clone().expand(10, 10);

    paper.selectRect = new Path.Rectangle(b);
    paper.selectRect.pivot = paper.selectRect.position;
    paper.selectRect.insert(2, new Point(b.center.x, b.top));
    paper.selectRect.insert(2, new Point(b.center.x, b.top - 25));
    paper.selectRect.insert(2, new Point(b.center.x, b.top));

    if (!reset) {
      paper.selectRect.position = path.bounds.center;
      paper.selectRect.rotation = path.rotation;
      paper.selectRect.scaling = path.scaling;
    }

    paper.selectRect.strokeWidth = 2;
    paper.selectRect.strokeColor = 'blue';
    paper.selectRect.name = "selection rectangle";
    paper.selectRect.selected = true;
    paper.selectRect.ppath = path;
    paper.selectRect.ppath.pivot = paper.selectRect.pivot;
  }

  function getBoundSelection(point) {
    // Check for items that are overlapping a rect around the event point
    var items = project.getItems({
      overlapping: new Rectangle(point.x - 2, point.y - 2,point.x + 2, point.y + 2)
    });

    var item = null;
    _.each(items, function (i) {

      if (paper.traceImage) {
        if (i == paper.traceImage) return; // Don't select the trace image group
        if (i == paper.traceImage.img) return; // Don't select the trace image
      }

      // TODO: Prioritize selection of paths completely inside of other paths
      if (i instanceof Path) {
        if (i.contains(point)) {
          item = i;
        }
      }
    });

    return item;
  }


  // Change the select tool mode to/from image trace mode
  tool.imageTraceMode = function(toggle) {
    paper.imageTraceMode = toggle;

    if (toggle) {
      initSelectionRectangle(paper.traceImage);
      tool.activate();
    } else {
      path = null;
      paper.deselect();
    }
  }

  return tool;
};
