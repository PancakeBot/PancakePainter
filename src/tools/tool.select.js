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
  var selectionRectangle = null;
  var selectionRectangleScale = null;
  var selectionRectangleRotation = null;
  var segment, path;
  var hitOptions = {
    segments: true,
    stroke: true,
    fill: true,
    tolerance: 5
  };

  // Externalize deseletion
  paper.deselect = function() {
    if (selectionRectangle) selectionRectangle.remove();
  }

  // Tool identification (for building out tool palette)
  tool.name = 'tools.select';
  tool.key = 'select';

  tool.onMouseDown = function(event) {
    segment = path = null;

    var hitResult = project.hitTest(event.point, hitOptions);

    // If we didn't hit anything with hitTest...
    if (!hitResult) {
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
        if (selectionRectangle !== null) {
          selectionRectangle.remove();
          selectionRectangle = null;
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
      path = hitResult.item;

      if (hitResult.type === 'segment') {
        if (selectionRectangle !== null && path.name === "selection rectangle") {
          if (hitResult.segment.index >= 2 && hitResult.segment.index <= 4) {
            // Rotation hitbox
            selectionRectangleRotation = 0;
          } else {
            // Scale hitbox
            selectionRectangleScale = event.point.subtract(selectionRectangle.bounds.center).length / path.scaling.x;
          }
        } else {
          segment = hitResult.segment;
        }
      } else if (hitResult.type === 'stroke' && path !== selectionRectangle) {
        var location = hitResult.location;
        segment = path.insert(location.index + 1, event.point);
        //path.smooth();
      }

      if ((selectionRectangle === null || selectionRectangle.ppath !== path) && selectionRectangle !== path) {
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
      var ratio = event.point.subtract(selectionRectangle.bounds.center).length / selectionRectangleScale;
      var scaling = new Point(ratio, ratio);
      selectionRectangle.scaling = scaling;
      selectionRectangle.ppath.scaling = scaling;
      return;
    } else if (selectionRectangleRotation !== null) {
      // Path rotation adjustment
      var rotation = event.point.subtract(selectionRectangle.pivot).angle + 90;
      selectionRectangle.ppath.rotation = rotation;
      selectionRectangle.rotation = rotation;
      return;
    }

    if (segment) {
      // Individual path segment position adjustment
      segment.point.x += event.delta.x;
      segment.point.y += event.delta.y;

      // Smooth -only- non-polygonal paths
      if (!path.data.isPolygonal) path.smooth();

      initSelectionRectangle(path);
    } else if (path) {
      // Path translate position adjustment
      if (path !== selectionRectangle) {
        path.position.x += event.delta.x;
        path.position.y += event.delta.y;
        selectionRectangle.position.x += event.delta.x;
        selectionRectangle.position.y += event.delta.y;
      } else {
        selectionRectangle.position.x += event.delta.x;
        selectionRectangle.position.y += event.delta.y;
        selectionRectangle.ppath.position.x += event.delta.x;
        selectionRectangle.ppath.position.y += event.delta.y;
      }
    }
  };

  tool.onMouseMove = function(event) {
    project.activeLayer.selected = false;

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

    if (selectionRectangle) {
      selectionRectangle.selected = true;
    }
  };

  tool.onMouseUp = function(event) {
    selectionRectangleScale = null;
    selectionRectangleRotation = null;
  };

  tool.onKeyDown = function (event) {
    if (event.key === 'delete' && selectionRectangle) {
      selectionRectangle.ppath.remove();
      selectionRectangle.remove();
      selectionRectangle = null;
    }
  };

  function initSelectionRectangle(path) {
    if (selectionRectangle !== null) selectionRectangle.remove();

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

    selectionRectangle = new Path.Rectangle(b);
    selectionRectangle.pivot = selectionRectangle.position;
    selectionRectangle.insert(2, new Point(b.center.x, b.top));
    selectionRectangle.insert(2, new Point(b.center.x, b.top - 25));
    selectionRectangle.insert(2, new Point(b.center.x, b.top));

    if (!reset) {
      selectionRectangle.position = path.bounds.center;
      selectionRectangle.rotation = path.rotation;
      selectionRectangle.scaling = path.scaling;
    }

    selectionRectangle.strokeWidth = 2;
    selectionRectangle.strokeColor = 'blue';
    selectionRectangle.name = "selection rectangle";
    selectionRectangle.selected = true;
    selectionRectangle.ppath = path;
    selectionRectangle.ppath.pivot = selectionRectangle.pivot;
  }

  function getBoundSelection(point) {
    // Check for items that are overlapping a rect around the event point
    var items = project.getItems({
      overlapping: new Rectangle(point.x - 2, point.y - 2,point.x + 2, point.y + 2)
    });

    var item = null;
    _.each(items, function (i) {
      if (i instanceof Path) {
        if (i.contains(point)) {
          item = i;
        }
      }
    });

    return item;
  }
};

