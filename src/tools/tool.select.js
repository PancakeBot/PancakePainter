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

    if(hitResult && hitResult.item.parent && hitResult.item.parent.className == "CompoundPath"){
      return;
    }

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

      // Don't select CompoundPath children
      if(item && item.parent && item.item.parent.className == "CompoundPath") return;

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
        if (paper.selectRect && paper.selectRect.ppath[0] === path) {
          // Add new segment node to the path (if it's already selected)
          var location = hitResult.location;
          segment = path.insert(location.index + 1, event.point);
        }
      }

      if ((paper.selectRect === null || paper.selectRect.ppath[0] !== path) && paper.selectRect !== path) {
        if(event.modifiers.shift){
          initSelectionRectangle(path, true);
        }
        else {
          initSelectionRectangle(path, false);
        }
      }
    }

    if (event.modifiers.shift) {
      if (hitResult.type === 'segment') {
        hitResult.segment.remove();
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
      paper.selectRect.scale(ratio);

      _.each(paper.selectRect.ppath, function (path) {
        if(path.name != "traced path") {
          path.scale(ratio);
        }
      });

      // If we are scaling any layer of the traced image then scale all the layers together
      if(anyTracingSelected()) {
        _.each(project.activeLayer.getItems({}), function(item){
          if(item.name == "traced path" && item.parent.className != "CompoundPath"){
            item.scale(ratio, paper.selectRect.bounds.center);
          }
        });
      }
      return;
    } else if (selectionRectangleRotation !== null) {
      // Path rotation adjustment
      var rotation = event.point.subtract(paper.selectRect.pivot).angle + 90;
      paper.selectRect.rotate(rotation);

      _.each(paper.selectRect.ppath, function (path) {
        if(path.name != "traced path"){
          path.rotate(rotation);
        }
      });

      // If we are rotating any layer of the traced image then rotate all the layers together
      if(anyTracingSelected()) {
        _.each(project.activeLayer.getItems({}), function(item){
          if(item.name == "traced path" && item.parent.className != "CompoundPath"){
            item.rotate(rotation, paper.selectRect.bounds.center);
          }
        });
      }
      return;
    }

    if (segment && !paper.imageTraceMode) {
      // Don't allow moving traced image segments
      if (segment.path.name != "traced path") {
        // Individual path segment position adjustment
        segment.point.x += event.delta.x;
        segment.point.y += event.delta.y;

        // Smooth -only- non-polygonal paths
        //if (!path.data.isPolygonal) path.smooth();

        initSelectionRectangle(path);
      }
    } else if (path) {
      // Path translate position adjustment
      if (path !== paper.selectRect) {
        if(path.name != "traced path"){
          path.translate(event.delta);
        }
        else {
          // Move all the traced layers together
          _.each(project.activeLayer.getItems({}), function(item){
            if(item.name == "traced path" && item.parent.className != "CompoundPath"){
              item.translate(event.delta);
            }
          });
        }

        paper.selectRect.position.x += event.delta.x;
        paper.selectRect.position.y += event.delta.y;
      } else {
        paper.selectRect.position = paper.selectRect.position.add(event.delta);

        _.each(paper.selectRect.ppath, function (path) {
          if(path.name != "traced path")
            path.translate(event.delta);
        });

        // Move all the traced layers together
        if(anyTracingSelected()) {
          _.each(project.activeLayer.getItems({}), function(item){
            if(item.name == "traced path" && item.parent.className != "CompoundPath"){
              item.translate(event.delta);
            }
          });
        }
      }
    }
  };

  tool.onMouseMove = function(event) {
    // deselect all the items. project.activeLayer.selected sometimes
    //  leaves some items selected
    _.each(project.activeLayer.getItems({}), function (item) {
      item.selected = false;
    });
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
    if (path || segment) {
      paper.cleanPath(path);
      paper.fileChanged();
    }
  };

  tool.onKeyDown = function (event) {
    if (paper.selectRect) {
      // Delete a selected path
      if (event.key === 'delete' || event.key === 'backspace') {
        _.each(paper.selectRect.ppath, function(path) {
          path.remove();
        });
        if (paper.imageTraceMode) paper.traceImage = null;
        paper.deselect();

        // Check if there are no more items in the project, remove the image path
        var items = project.activeLayer.getItems({});
        if(items.length == 1) {
          if(items[0].name == "selection rectangle") {
            paper.clearImageTracing();
          }
        }
        else if(items.length == 0) {
          paper.clearImageTracing();
        }
      }

      // Deselect
      if (event.key === 'escape') {
        _.each(paper.selectRect.ppath, function (path) {
          path.fullySelected = false;
        });
        paper.selectRect.ppath = [];
        paper.deselect();
      }

    }
  };

  function initSelectionRectangle(path, add) {
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

    if(paper.selectRect && add) {
      var boxes = [];
      _.each(paper.selectRect.ppath, function (path) {
        boxes.push(path.bounds);
      });
      boxes.push(bounds);

      bounds = combineBoundingBoxes(boxes);
    }
    var b = bounds.clone().expand(25, 25);

    if(add){
      var ppath = undefined;
      if(!paper.selectRect || !paper.selectRect.ppath) ppath = [];
      else ppath = paper.selectRect.ppath;
    }
    if (paper.selectRect !== null)
      paper.selectRect.remove();

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
    if(add) {
      paper.selectRect.ppath = ppath;
      paper.selectRect.ppath.push(path);
    }
    else {
      paper.selectRect.ppath = [path];
    }
    _.each(paper.selectRect.ppath, function (path) {
      path.pivot = paper.selectRect.pivot;
    });
  }

  function combineBoundingBoxes(bounds) {
    var minX = bounds[0].left,
        minY = bounds[0].top,
        maxX = bounds[0].right,
        maxY = bounds[0].bottom;

    _.each(bounds, function (bound) {
      minX = Math.min(minX, bound.left);
      minY = Math.min(minY, bound.top);
      maxX = Math.max(maxX, bound.right);
      maxY = Math.max(maxY, bound.bottom);
    });

    var r = new Path.Rectangle(minX, minY, maxX - minX, maxY - minY);
    var b = r.bounds.clone();
    r.remove(); // Remove the rectangle from the paper
    return b;
  }

  function anyTracingSelected() {
    // Check if any path of the traced image is selected
    if(paper.selectRect && paper.selectRect.ppath){
      for(var n = 0; n < paper.selectRect.ppath.length; ++n) {
        if(paper.selectRect.ppath[n].name == "traced path"){
          return true;
        }
      }
    }

    return false;
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

  tool.selectNewSvg = function() {
    // Select the entire traced image but don't select CompoundPath children, just select the
    //  entire compound path
    _.each(project.activeLayer.getItems({}), function (item) {
      if(item.name == "traced path" && item.parent.className != "CompoundPath") {
        initSelectionRectangle(item, true);
      }
    });
    tool.activate();
  };

  return tool;
};
