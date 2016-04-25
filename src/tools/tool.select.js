/**
 * @file Tool definition for the PC dual purpose selection tool. Provides event
 * handlers and special logic for the selection tool ONLY. Allows selection of
 * entire objects, rotation, scaling and node/segment adjustment.
 **/
"use strict";
/*globals _ */

module.exports = function(paper) {
  var tool = new paper.Tool();

  // Paper global extenders
  var Path = paper.Path;
  var Point = paper.Point;
  var Rectangle = paper.Rectangle;
  var project = paper.project;

  // Handy internal vars
  paper.selectRect = null;
  paper.selectRectLast = null;
  var selectionRectangleScale = null;
  var selectionRectangleRotation = null;
  var segment, path, selectChange;
  paper.imageTraceMode = false;
  var hitOptions = {
    segments: true,
    stroke: true,
    fill: true,
    tolerance: 5
  };

  // Externalize deseletion
  paper.deselect = function(noFinish) {
    if (paper.selectRect) {
      paper.selectRectLast = paper.selectRect;
      paper.selectRect.remove();
      paper.selectRect = null;

      // Complete imageTraceMode if we're deselecting.
      if (paper.imageTraceMode && !noFinish) {
        paper.finishImageImport();
      }
    }
  };

  paper.reselect = function() {
    if (paper.selectRectLast && paper.tool.name === 'tools.select') {
      project.activeLayer.addChild(paper.selectRectLast);
      paper.selectRect = paper.selectRectLast;
      paper.selectRectLast = null;
    }
  };

  // Tool identification (for building out tool palette)
  tool.name = 'tools.select';
  tool.key = 'select';
  tool.cursorOffset = '1 1'; // Position for cursor point

  tool.onMouseDown = function(event) {
    segment = path = selectChange = null;
    console.log('shift?', event.modifiers.shift);
    var hitResult = project.hitTest(event.point, hitOptions);

    // Don't select image if not in trace mode
    if (hitResult && !paper.imageTraceMode) {
      if (paper.traceImage) {
        if (hitResult.item === paper.traceImage ||
            hitResult.item === paper.traceImage.img) {
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

    if (hitResult) {
      if (paper.imageTraceMode) {

        // Select the group, not the image
        if (hitResult.item === paper.traceImage.img) {
          hitResult.item = paper.traceImage;
        }

        //console.log('HITRESULT', hitResult.item);

        // Don't select any other items if in image trace mode
        if (hitResult.item !== paper.selectRect &&
            hitResult.item !== paper.traceImage) {
          return;
        }
      }

      path = hitResult.item;
      var pickingSelectRect = paper.selectRect === path;

      if (hitResult.type === 'segment') {
        // Remove segment on shift click.
        if (event.modifiers.shift && !pickingSelectRect) {
          hitResult.segment.remove();
          return;
        }

        if (paper.selectRect !== null && path.name === "selection rectangle") {
          if (hitResult.segment.index >= 2 && hitResult.segment.index <= 4) {
            // Rotation hitbox
            selectionRectangleRotation = 0;
          } else {
            // Scale hitbox
            var center = event.point.subtract(paper.selectRect.bounds.center);
            selectionRectangleScale = center.length / path.scaling.x;
          }
        } else {
          segment = hitResult.segment;
        }
      } else if (hitResult.type === 'stroke' && path !== paper.selectRect) {
        if (paper.selectRect && paper.selectRect.ppath === path) {
          // Add new segment node to the path (if it's already selected)
          var location = hitResult.location;
          segment = path.insert(location.index + 1, event.point);
        }
      }

      // If a fill hit, move the path to the front.
      if (hitResult.type === 'fill') {
        hitResult.item.bringToFront();
      }

      var pathAlreadySelected = false;
      if (paper.selectRect) {
        pathAlreadySelected = paper.selectRect.ppaths.indexOf(path) > -1;
      }

      if (event.modifiers.shift) {
        // If pressing shift, try to look for paths inside of selection.
        var insideItem = getBoundSelection(event.point, true);
        pathAlreadySelected = paper.selectRect.ppaths.indexOf(insideItem) > -1;

        if (!pickingSelectRect ||
           (pickingSelectRect && insideItem !== path && !pathAlreadySelected)) {
          console.log('Add to Selection');
          selectChange = true;
          addToSelection(insideItem);
        } else if (pathAlreadySelected) {
          selectChange = true;
          removeFromSelection(insideItem);
        }
      } else if (!pickingSelectRect && !pathAlreadySelected) {
        console.log('pickingSelectRect INIT');
        initSelectionRectangle(path);
      }

    }

  };

  tool.onMouseDrag = function(event) {
    if (event.modifiers.shift) return;
    if (selectionRectangleScale !== null) {
      // Path scale adjustment
      var centerDiff = event.point.subtract(paper.selectRect.bounds.center);
      var ratio = centerDiff.length / selectionRectangleScale;
      var scaling = new Point(ratio, ratio);
      paper.selectRect.scaling = scaling;
      _.each(paper.selectRect.ppaths, function(path){
        path.scaling = scaling;
      });

      return;
    } else if (selectionRectangleRotation !== null) {
      // Path rotation adjustment
      var rotation = event.point.subtract(paper.selectRect.pivot).angle + 90;
      paper.selectRect.rotation = rotation;
      _.each(paper.selectRect.ppaths, function(path){
        path.rotation = rotation;
      });
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
      var psr = paper.selectRect;

      // Path translate position adjustment
      if (path !== paper.selectRect) {
        path.position.x += event.delta.x;
        path.position.y += event.delta.y;
        psr.position.x += event.delta.x;
        psr.position.y += event.delta.y;
      } else {
        psr.position = psr.position.add(event.delta);
        _.each(psr.ppaths, function(path){
          path.position = psr.position.add(event.delta);
        });

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
        if (event.item === paper.traceImage) return;
        if (event.item === paper.traceImage.img) return;
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

  tool.onMouseUp = function() {
    selectionRectangleScale = null;
    selectionRectangleRotation = null;

    // If we have a mouse up with either of these, the file has changed!
    if ((path || segment) && !selectChange) {
      paper.cleanPath(path);
      paper.fileChanged();
    }
  };

  tool.onKeyDown = function (event) {
    if (paper.selectRect) {
      // Delete a selected path
      if (event.key === 'delete' || event.key === 'backspace') {
        _.each(paper.selectRect.ppaths, function(path){
          path.remove();
        });

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

  paper.selectPath = initSelectionRectangle;
  function initSelectionRectangle(path) {
    console.log('INIT Selection');
    if (paper.selectRect !== null) paper.deselect();
    var reset = path.rotation === 0 && path.scaling.x === 1 && path.scaling.y === 1;
    var bounds;

    if (reset) {
      // Actually reset bounding box
      bounds = path.bounds;
      path.pInitialBounds = path.bounds;
    } else {
      // No bounding box reset
      bounds = path.pInitialBounds ? path.pInitialBounds : path.bounds;
    }

    var b = bounds.clone().expand(25, 25);

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
    paper.selectRect.ppaths = [path];
    paper.selectRect.ppath.pivot = paper.selectRect.pivot;
  }

  // Add to an existing selection
  paper.selectAdd = addToSelection;
  function addToSelection(path) {
    if (paper.selectRect === null) {
      initSelectionRectangle(path);
      return;
    }

    // Don't try to add our own selection rectangle or non-paths to selections!
    if (paper.selectRect === path || !(path instanceof Path)) {
      return;
    }

    // Don't try existing paths.
    if (paper.selectRect.ppaths.indexOf(path) !== -1) {
      return;
    }

    paper.selectRect.ppaths.push(path);
    fixGroupSelectRect();
  }

  // Add to an existing selection
  paper.selectRemove = removeFromSelection;
  function removeFromSelection(path) {
    // No selection? Can't do anything.
    if (paper.selectRect === null) {
      return;
    }

    // Otherwise, move through all the paths and match it up.
    var findIndex = paper.selectRect.ppaths.indexOf(path);
    if (findIndex !== -1) {
      paper.selectRect.ppaths.splice(findIndex, 1);
      fixGroupSelectRect();
    }
  }

  // Fix the group selection rectangle.
  function fixGroupSelectRect() {
    // No selection? Can't do anything.
    if (paper.selectRect === null) {
      return;
    }

    // If there's no items in selection, assume deselection.
    if (paper.selectRect.ppaths.length === 0) {
      paper.deselect();
      return;
    }

    // If there's only one item in selection, just reset it.
    if (paper.selectRect.ppaths.length === 1) {
      initSelectionRectangle(paper.selectRect.ppaths[0]);
      return;
    }

    // Otherwise, reset the existing selection rectangle around the paths.
    var bounds = paper.selectRect.ppaths[0].bounds;
    _.each(paper.selectRect.ppaths, function(p) {
      bounds = p.bounds.unite(bounds);
    });

    var b = bounds.clone().expand(25, 25);
    paper.selectRect.bringToFront();
    paper.selectRect.position = b.center;
    paper.selectRect.segments[0].point = new Point(b.left, b.bottom);
    paper.selectRect.segments[1].point = new Point(b.left, b.top);
    paper.selectRect.segments[5].point = new Point(b.right, b.top);
    paper.selectRect.segments[6].point = new Point(b.right, b.bottom);

    paper.selectRect.segments[4].point = new Point(b.center.x, b.top);
    paper.selectRect.segments[3].point = new Point(b.center.x, b.top - 25);
    paper.selectRect.segments[2].point = new Point(b.center.x, b.top);
    paper.selectRect.pivot = b.center;

    _.each(paper.selectRect.ppaths, function(p) {
      p.pivot = paper.selectRect.pivot;
    });
  }


  function getBoundSelection(point, ignoreSelectRect) {
    // Check for items that are overlapping a rect around the event point
    var items = project.getItems({
      overlapping: new Rectangle(
        point.x - 2,
        point.y - 2,
        point.x + 2,
        point.y + 2
      )
    });

    var item = null;
    _.each(items, function (i) {

      if (paper.traceImage) {
        if (i === paper.traceImage) return; // Don't select the trace img group
        if (i === paper.traceImage.img) return; // Don't select the trace image
      }

      if (ignoreSelectRect) {
        if (i === paper.selectRect) return; // Don't select select rect.
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
  };

  return tool;
};
