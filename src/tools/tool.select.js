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
  var CompoundPath = paper.CompoundPath;
  var Point = paper.Point;
  var Rectangle = paper.Rectangle;
  var project = paper.project;

  // Handy internal vars
  paper.selectRect = null;
  paper.selectRectLast = null;
  var selectionRectangleScale = null;
  var selectionRectangleRotation = null;
  var segment, path, selectChangeOnly;
  paper.imageTraceMode = false;

  // Externalize deselection
  paper.deselect = function(noFinish) {
    if (paper.selectRect) {
      // Completely deselect sub paths
      _.each(paper.selectRect.ppaths, function(path) {
        path.selected = false;
        path.fullySelected = false;
      });

      paper.selectRectLast = paper.selectRect;
      paper.selectRect.remove();
      paper.selectRect = null;

      // Complete imageTraceMode if we're deselecting.
      if (paper.imageTraceMode && !noFinish) {
        paper.finishImageImport();
      }
    }
  };

  // Externalize reselect of last selection.
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

  // Hittest wrapper for greater select abstraction.
  paper.selectTestResult = function (event, options) {
    var hitOptions = {
      segments: true,
      stroke: true,
      fill: true,
      class: Path,
      tolerance: 5
    };

    hitOptions = _.extend(hitOptions, options);
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
      // Finish if in imageTraceMode.
      if (paper.imageTraceMode) {
        return false;
      }

      // Find any items that are Paths (not layers) that contain the point
      var item = getBoundSelection(event.point);

      // If we actually found something, fake a fill hitResult
      if (item) {
        hitResult = {
          type: 'bounds',
          item: item
        };
      } else {
        return false;
      }
    }

    // From this point on, we must have clicked something.
    var path = hitResult.item;

    // Figure out useful selection state switches:
    hitResult.pickingSelectRect = false;
    hitResult.multiSelect = false;
    hitResult.itemSelected = false;
    hitResult.hasSelection = false;
    hitResult.insideItem = null;
    hitResult.insideItemSelected = false;

    if (paper.selectRect) {
      var ppaths = paper.selectRect.ppaths;
      hitResult.hasSelection = true;
      hitResult.multiSelect = ppaths.length > 1;
      hitResult.itemSelected = ppaths.indexOf(path) > -1;
      hitResult.pickingSelectRect = paper.selectRect === path;

      // If we're selecting the selectRect via bounds, try to find an item a
      // user might be trying to select inside of it.
      hitResult.insideItem = getBoundSelection(event.point, true);
      hitResult.insideItemSelected = ppaths.indexOf(hitResult.insideItem) > -1;

      // If not picking select rect and no inside item, default to current.
      if (!hitResult.insideItem && !hitResult.pickingSelectRect) {
        hitResult.insideItem = hitResult.item;
        hitResult.insideItemSelected = hitResult.itemSelected;
      }

    }

    return hitResult;
  };

  // User clicks with the mouse on the canvas:
  tool.onMouseDown = function(event) {
    segment = path = selectChangeOnly = null;

    // Always ensure the select Rect is above everything else before tests.
    if (paper.selectRect) {
      paper.selectRect.bringToFront();
    }
    var clickResult = paper.selectTestResult(event);

    // Finish early and deselect if we didn't click anything.
    if (!clickResult) {
      // If we're pressing shift, don't deselect.
      if (!event.modifiers.shift) {
        paper.deselect();
      }
      return;
    }

    // We can assume we've clicked on soemthing at this point.
    path = clickResult.item;

    // When in image trace mode, regular selections are ignored.
    if (paper.imageTraceMode) {
      // Select the group, not the image
      if (clickResult.item === paper.traceImage.img) {
        clickResult.item = paper.traceImage;
        path = clickResult.item;
      }

      // Don't select any other items if in image trace mode
      if (!clickResult.pickingSelectRect && path !== paper.traceImage) {
        return;
      }
    }

    // Clicking one of the selection modifier hitbox nodes:
    if (clickResult.pickingSelectRect && clickResult.type === 'segment') {
      if (clickResult.segment.index >= 2 && clickResult.segment.index <= 4) {
        // Rotation hitbox
        selectionRectangleRotation = 0;
      } else {
        // Scale hitbox
        var center = event.point.subtract(paper.selectRect.bounds.center);
        selectionRectangleScale = center.length / path.scaling.x;
      }
    }

    // Don't do anything more if on image trace mode.
    if (paper.imageTraceMode) {
      return;
    }

    // If not while multi selecting...
    if (!clickResult.multiSelect && !clickResult.pickingSelectRect) {
      // Clicking on a path node segment:
      if (clickResult.type === 'segment') {
        // Remove segment on shift click only on selected item.
        if (event.modifiers.shift && clickResult.itemSelected) {
          clickResult.segment.remove();
          return;
        } else {
          // Not shift clicking, not multiselect, globalize the segment so it
          // can be repositioned.
          segment = clickResult.segment;
        }

      } else if (clickResult.type === 'stroke'){
        // Add new segment node to the path (if it's already selected)
        if (clickResult.itemSelected) {
          var location = clickResult.location;
          segment = path.insert(location.index + 1, event.point);
        }
      }
    }

    // Move the path to the front.
    path.bringToFront();

    // If pressing shift, try to look for paths inside of selection.
    if (event.modifiers.shift) {
      if (!clickResult.insideItemSelected) {
        selectChangeOnly = true;
        addToSelection(clickResult.insideItem);
      } else {
        selectChangeOnly = true;
        removeFromSelection(clickResult.insideItem);
      }
    } else if (!clickResult.itemSelected &&
               !clickResult.pickingSelectRect) {
      selectChangeOnly = true;
      initSelectionRectangle(path);
    }
  };

  tool.onMouseDrag = function(event) {
    if (event.modifiers.shift) return;
    if (selectionRectangleScale !== null) {
      // Path scale adjustment
      var centerDiff = event.point.subtract(paper.selectRect.bounds.center);
      var ratio = centerDiff.length / selectionRectangleScale;

      paper.selectRect.scale(ratio);
      _.each(paper.selectRect.ppaths, function(path){
        if(path.name !== "traced path"){
          path.scale(ratio);
        }
      });

      if(isAnyTracingSelected()){
        // Scale all the traced layers together
        _.each(project.activeLayer.getItems({}), function (item) {
          if(item.name === "traced path" &&
              item.parent.className !== "CompoundPath"){
            path.scale(ratio, paper.selectRect.bounds.center);
          }
        });
      }

      return;
    } else if (selectionRectangleRotation !== null) {
      // Path rotation adjustment
      var rotation = event.point.subtract(paper.selectRect.pivot).angle + 90;
      paper.selectRect.rotate(rotation);

      _.each(paper.selectRect.ppaths, function(path){
        if(path.name !== "traced path"){
          path.rotate(rotation, paper.selectRect.bounds.center);
        }
      });

      if(isAnyTracingSelected()){
        // Rotate all the traced layers together
        _.each(project.activeLayer.getItems({}), function (item) {
          if(item.name === "traced path" &&
              item.parent.className !== "CompoundPath"){
            path.rotate(rotation, paper.selectRect.bounds.center);
          }
        });
      }

      return;
    }

    if (segment && !paper.imageTraceMode) {
      // Individual path segment position adjustment
      segment.point = segment.point.add(event.delta);

      selectChangeOnly = false;
      initSelectionRectangle(path);
    } else if (path) {
      selectChangeOnly = false;
      var psr = paper.selectRect;

      // Path translate position adjustment
      psr.position = psr.position.add(event.delta);

      _.each(psr.ppaths, function(path){
        if(path.name !== "traced path"){
          path.translate(event.delta);
        }
      });

      if(isAnyTracingSelected()){
        // Move all the traced layers together
        _.each(project.activeLayer.getItems({}), function (item) {
          if(item.name === "traced path" &&
              item.parent.className !== "CompoundPath"){
            item.translate(event.delta);
          }
        });
      }
    }
  };

  tool.onMouseMove = function(event) {
    project.activeLayer.selected = false;
    project.activeLayer.fullySelected = false;

    _.each(project.getItems({class: 'Path'}), function (item) {
      item.selected = false;
    });

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


    var clickResult = paper.selectTestResult(event);

    if (event.item) {
      event.item.selected = true;
      paper.setCursor('copy');
    } else if (clickResult) {
      if (!clickResult.pickingSelectRect) {
        clickResult.item.selected = true;
      }
      paper.setCursor('move');
    } else {
      paper.setCursor();
    }
  };

  tool.onMouseUp = function() {
    selectionRectangleScale = null;
    selectionRectangleRotation = null;

    // If we have a mouse up with either of these, the file has changed!
    if ((path || segment) && !selectChangeOnly) {
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

        // Check if there are no more items in the project,
        //  remove the image path
        var items = project.activeLayer.getItems({});
        if(items.length === 1) {
          if(items[0].name === "selection rectangle") {
            paper.clearImageTracing();
          }
        }
        else if(items.length === 0) {
          paper.clearImageTracing();
        }
      }

      // Deselect
      if (event.key === 'escape') {
        paper.deselect();
      }

    }
  };

  paper.selectPath = initSelectionRectangle;
  function initSelectionRectangle(path) {
    paper.deselect();

    // Ensure we're selecting the right path.
    path = ensureSelectable(path, true);
    if (!path) return;

    var reset = path.rotation === 0 &&
                path.scaling.x === 1 &&
                path.scaling.y === 1;
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

  /**
   * Checks if any path of the traced image is selected
   * @returns {boolean} true if any path of the image is selected, false otherwise
   */
  function isAnyTracingSelected() {
    // Check if any path of the traced image is selected
    if(paper.selectRect && paper.selectRect.ppath){
      for(var n = 0; n < paper.selectRect.ppaths.length; ++n){
        if(paper.selectRect.ppaths[n].name === "traced path"){
          return true;
        }
      }
    }

    return false;
  }

  // Make sure the passed path is selectable, returns null, the path (or parent)
  function ensureSelectable(path, skipType) {
    // Falsey passed? Can't select that.
    if (!path) {
      return null;
    }

    // Is a child of a compound path? Select the parent.
    if (path.parent instanceof CompoundPath) {
      path = path.parent;
    }

    if (!skipType) {
      // Not a path or compound path? Can't select that.
      if (!(path instanceof Path) && !(path instanceof CompoundPath)) {
        return null;
      }
    }

    // If we have a selection...
    if (paper.selectRect) {
      // Is the same path as the select rectangle? Can't select that.
      if (path === paper.selectRect) {
        return null;
      }

      // Already selected? Can't select it.
      if (paper.selectRect.ppaths.indexOf(path) !== -1) {
        return null;
      }
    }

    return path;
  }

  // Add to an existing selection
  paper.selectAdd = addToSelection;
  function addToSelection(path) {
    // Only add to selection if we have a selection.
    if (paper.selectRect === null) {
      initSelectionRectangle(path);
      return;
    }

    // Don't try to add our own selection rectangle or non-paths to selections!
    path = ensureSelectable(path);
    if (!path) {
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

  // Select all top level items.
  tool.selectAll = function() {
    paper.deselect();

    var paths = [];
    _.each(project.activeLayer.children, function(path){
      if (path instanceof paper.Path || path instanceof paper.CompoundPath) {
        paths.push(path);
      }
    });

    // No paths? Don't select anything.
    if (!paths.length) return;

    addToSelection(paths[0]);
    paper.selectRect.ppaths = paths;
    fixGroupSelectRect();
  };

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

    // If we're ignoring the select Rect, we want only osmehting selctable.
    if (ignoreSelectRect) {
      return ensureSelectable(item);
    }
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

  tool.selectNewSvg = function() {
    // Select the entire traced image but don't select CompoundPath
    //  children, just select the entire compound path
    _.each(project.activeLayer.getItems({}), function (item) {
      if(item.name === "traced path" &&
          item.parent.className !== "CompoundPath") {
        initSelectionRectangle(item, true);
      }
    });
    tool.activate();
  };

  return tool;
};
