/**
 * @file Tool definition for the PC super-crazy visual flood fill tool.
 **/
"use strict";

module.exports = function(paper) {
  var tool = new paper.Tool();

  // Paper global extenders
  var Path = paper.Path;
  var Point = paper.Point;
  var Rectangle = paper.Rectangle;
  var project = paper.project;
  var CompoundPath = paper.CompoundPath;

  // Tool identification (for building out tool palette)
  tool.name = 'tools.fill';
  tool.key = 'fill';
  tool.cursorColors = true; // Different icons/cursor for each color?
  tool.cursorOffset = '1 9'; // Position for cursor point
  tool.pathSimplifyAmt = 0.7; // How much to simplify pixel boundary paths
  tool.islandThreshold = 10; // Max distance between fill boundary nodes
  tool.alphaBitmapThreshold = 50; // 0-255, value that's considered visible

  // Tool vars
  var ndarray = require('ndarray');
  var flood = require('n-dimensional-flood-fill');

  tool.onMouseDown = function(event) {
    var fillPath = floodFill(event.point);
    if (fillPath !== false) {
      fillPath.fillColor = paper.pancakeShades[paper.pancakeCurrentShade]
      fillPath.data.color = paper.pancakeCurrentShade;
      paper.fileChanged();
    }
  };


  // Attempt to flood fill at the given point, on the current layer.
  // Will return false if clicked out of bounds or floods to boundary.
  // Otherwise will return either the fill path underneath the point, or the
  // new fill path created.
  function floodFill(point) {
    var cLayer = project.getActiveLayer();

    // Check for Paths
    if (cLayer.children.length === 0) {
      // No paths? Can't do a darn thing.
      toastr.warning(i18n.t("tools.warnings.fill.nopaths"));
      return;
    }

    // Fist check to see if the user clicked ON a stroke or existing fill
    var ht = cLayer.hitTest(point, {
      tolerance: 3,
      fill: true,
      stroke: true
    });

    if (ht) {
      if (ht.item.data.fill) {
        return ht.item;
      } else {
        toastr.warning(i18n.t("tools.warnings.fill.path"));
        return false;
      }
    }

    var rast = cLayer.rasterize(50);
    var w = rast.width; var h = rast.height;
    var pix = rast.getImageData(new Rectangle(0, 0, w, h)).data;
    var grid = ndarray(new Int8Array(pix.length/4), [w-1, h-1]);
    var boundaryPoints = [];

    // Move through all RGBA pixel data to generate a 1bit map of visible pix.
    for (var p = 0; p < pix.length; p+= 4) {
      // If the alpha is greater than threshold, it's visible! Map a 1.
      if (pix[p+3] > tool.alphaBitmapThreshold) {
        grid.set((p / 4) % w, Math.floor((p / 4) / w), 1);
      }
    }

    var rastPt = rast.globalToLocal(point);
    // Offset for centered matrix position and trunc floats.
    rastPt.x = parseInt(rastPt.x + w/2);
    rastPt.y = parseInt(rastPt.y + h/2);

    // Outside the bounds of the layer data!
    if (rastPt.x > w || rastPt.x < 0 || rastPt.y > h || rastPt.y < 0) {
      toastr.warning(i18n.t("tools.warnings.fill.bounds"));
      rast.remove();
      return false;
    }

    // n-dimensional-flood-fill
    var hitLimit = false;
    flood({
      seed: [rastPt.x, rastPt.y],
      getter: function(x, y){
        // Apparently ndarray will take insane values and return real values :/
        if (x < 0  || y < 0 || x > w || y > h || hitLimit) return undefined;
        return grid.get(x, y);
      },
      onBoundary: function(x, y) {
        if (x === w || x === 0 || y === h || y === 0) {
          hitLimit = true;
        }

        if (!hitLimit) {
          boundaryPoints.push(rast.localToGlobal(new Point(x - w/2, y - h/2)));
        }
      }
    });

    // If our flood fill touched the edge of the layer, fill wasn't closed.
    if (hitLimit) {
      toastr.warning(i18n.t("tools.warnings.fill.notclosed"));
      rast.remove();
      return false;
    }

    // We're done with the raster.
    rast.remove();

    // Create the compound fillpath from the boundary points.
    var fillPath = new CompoundPath({
      children: getCompoundBoundaryPaths(boundaryPoints),
      data: {fill: true}
    });
    fillPath.remove();
    cLayer.insertChild(0, fillPath); // Put all fills at the bottom

    return fillPath;
  }

  // Convert the list of fill boundary points into an array of paths.
  // If you're filling a face, everything within it will be a new path,
  function getCompoundBoundaryPaths(bPoints) {
    var pathGroups = distanceSort(bPoints);
    var out = [];
    _.each(pathGroups, function(segments){
      out.push(new Path({
        closed: true,
        segments: segments
      }));
      out[out.length-1].simplify(tool.pathSimplifyAmt);
    });
    return out;
  }

  // Sort an array of Points by distance, grouped by distance threshold.
  function distanceSort(points) {
    // Use an external function to find the most appropriate starting point.
    var out = [[points.splice(getFillStartID(points), 1)[0]]];
    var cGroup = 0;

    // Loop through every point, adding the next closest point,
    // removing the previous points.
    while (points.length) {
      var lastPoint = out[cGroup][out[cGroup].length-1];
      var nextPoint = closestPoint(lastPoint, points);

      // If the distance is further away than "normal", we must be jumping to a
      // sub path. Increment the group.
      if (nextPoint.dist > tool.islandThreshold) {
        cGroup++;
        out[cGroup] = [];
      }

      out[cGroup].push(points.splice(nextPoint.id, 1)[0]);
    }

    return out;
  }

  // Given a list of points, find the one closest to the given point.
  function closestPoint(point, list) {
    var closestID = 0;
    var closest = point.getDistance(list[0]);
    _.each(list, function(p, index){
      var dist = point.getDistance(p);
      if (dist < closest) {
        closest = dist;
        closestID = index;
      }
    });

    return {id: closestID, dist: closest};
  }


  // Find the most appropriate fill starting point given an array of points.
  function getFillStartID(points) {
    var bestID = 0;
    var lowestY = points[0].y;
    _.each(points, function(p, index){
      if (p.y < lowestY) {
        lowestY = p.y;
        bestID = index;
      }
    });

    return bestID;
  }

  return tool;
};
