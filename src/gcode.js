/**
 * @file This file contains the abstractions required for rendering the Paper.js
 * paths into GCODE compatible with the PancakeBot.
 **/
"use strict";

module.exports = function(config) {
  var paper = config.paper;
  var Point = paper.Point;
  var returnRenderer = {}; // The function/object returned by this module

  // Create gcode from current project
  returnRenderer = function generateGcode(noMirror) {
    var workLayer = paper.project.getActiveLayer().clone();
    var out = getCodeHeader();
    config.noMirror = noMirror;

    // Convert all fill paths in the work layer into fills.
    // Must use a fillList because removing paths changes the children list
    var fillList = [];
    _.each(workLayer.children, function(path){
      if (path.data.fill === true) {
        fillList.push(path);
      }
    });

    workLayer.activate();
    _.each(fillList, function(path){
      paper.fillTracePath(path, config);
    });

    var numPaths = workLayer.children.length;
    var colorGroups = [];

    // Clean up remaining drawn closed paths to be easier to manage
    convertAllClosedPaths(workLayer);

    // Travel sort the work layer to get everything in the right order.
    travelSortLayer(workLayer);

    // Move through each path on the worklayer, and group them in reverse order
    // by color shade, 0-3, darker first (indicated in the path data.color).
    _.each(workLayer.children, function(path){
      var revIndex = 3 - path.data.color;

      if (!colorGroups[revIndex]) colorGroups[revIndex] = [];
      colorGroups[revIndex].push(path);
    });

    // Move through each color
    var pathCount = 0;
    _.each(colorGroups, function(group, groupIndex){
      // Move through each path in the given color group
      _.each(group, function(path){
        pathCount++;
        out += [
          gc('note', 'Starting path #' + pathCount + '/' + numPaths + ', segments: ' + path.segments.length + ', length: ' + Math.round(path.length) + ', color #' + (path.data.color + 1)),
          renderPath(path),
          gc('note', 'Completed path #' + pathCount + '/' + numPaths  + ' on color #' + (path.data.color + 1))
        ].join('');
      });

      // Trigger color change if we had paths previously, and the next color
      // group has paths to be rendered.
      if (colorGroups[groupIndex+1] && pathCount !== 0) {
        out += getCodeColorChange(colorGroups[groupIndex+1][0].data.color);
      }
    });

    out += getCodeFooter();

    workLayer.remove();
    return out;
  };

  // Render the given path into GCODE
  function renderPath(path) {
    if (!path.data.isPolygonal) {
      path.flatten(config.flattenResolution);
    }

    var pumpOff = false;
    var out = '';

    // Create an artificial move to the exact point where the pump should turn
    // off, before the next move occurs to ensure correct drip timing.
    var offset = Math.max(0, Math.min(path.length, path.length - config.lineEndPreShutoff));
    var gcPreShutoff = [
      gc('note', 'Nearing path end, moving to preshutoff position'),
      gc('move', reMap(path.getPointAt(offset))),
      gc('pumpoff')
    ].join('');

    // Render segment points to Gcode movements
    _.each(path.segments, function(segment, index){

      // If we're on the last segment of a path (here before we've moved to that
      // point), and we're beyond the standard pre-shutoff, run that
      if (index === path.segments.length -1) {
        if (path.length - path.getOffsetOf(segment.point) <= config.lineEndPreShutoff && !pumpOff) {
          pumpOff = true;
          out+= gcPreShutoff;
        }
      }


      out+= gc('move', reMap(segment.point)); // Start by moving to this path segment

      if (index === 0) { // First path segment
        // After we've moved to the point, start the pump and wait for it to warm up
        out+= [gc('pumpon'), gc('wait', config.startWait), ''].join('');
      } else if (index === path.segments.length-1) { // Last path segment
        // Last segment/movement, dwell on the last point
        out+= gc('wait', config.endWait);
      } else { // Not the first or last path segment.
        // If the remaining length of the line is less than the shutoff value,
        // throw in the early shutoff. Must happen AFTER initial pumpOn above.
        if (path.length - path.getOffsetOf(segment.point) <= config.lineEndPreShutoff && !pumpOff) {
          pumpOff = true;
          out+= gcPreShutoff;
        }
      }

      // If the remaining length of the line is less than the shutoff value,
      // throw in the early shutoff. Must happen AFTER initial pumpOn above.
      if (path.length - path.getOffsetOf(segment.point) <= config.lineEndPreShutoff && !pumpOff) {
        pumpOff = true;
        out+=[
          gc('note', 'Very short path, early shutoff without move'),
          gc('pumpoff')
        ].join('');
      }

    });
    return out;
  }

  // Generate Gcode Header
  function getCodeHeader() {
    return [
      gc('note', 'PancakePainter v' + config.version + ' GCODE header start'),
      gc('note', 'Originally generated @ ' + new Date().toString()),
      gc('note', 'Settings used to generate this file:'),
      gc('note', '----------------------------------------'),
      gc('note', 'flattenResolution: ' + config.flattenResolution),
      gc('note', 'lineEndPreShutoff: ' + config.lineEndPreShutoff),
      gc('note', 'startWait: ' + config.startWait),
      gc('note', 'endWait: ' + config.endWait),
      gc('note', 'shadeChangeWait: ' + config.shadeChangeWait),
      gc('note', 'fillSpacing: ' + config.fillSpacing),
      gc('note', 'fillAngle: ' + config.fillAngle),
      gc('note', 'fillGroupThreshold: ' + config.fillGroupThreshold),
      gc('note', '----------------------------------------'),
      gc('workspace', config.printArea),
      gc('units'),
      gc('speed', 5600),
      gc('pumpoff'),
      gc('wait', 1000),
      gc('off'),
      gc('home'),
      gc('note', 'PancakePainter header complete'),
    ].join('');
  }

  // Generate Gcode footer
  function getCodeFooter() {
    return [
      gc('note', 'PancakePainter Footer Start'),
      gc('wait', 1000),
      gc('home'),
      gc('off'),
      gc('note', 'PancakePainter Footer Complete'),
    ].join('');
  }

  // Generate Color change
  function getCodeColorChange(id) {
    return [
      gc('note', 'Switching Color to: ' + paper.pancakeShadeNames[id]),
      gc('wait', 1000),
      gc('home'),
      gc('off'),
      gc('change'),
      gc('wait', config.shadeChangeWait * 1000),
    ].join('');
  }

  /**
   * Create a serial command string from a key:value object
   *
   * @param {string} name
   *   Key in cmds object to find the command string
   * @param {object|string|integer} values
   *   Object containing the keys of placeholders to find in command string, with
   *   value to replace placeholder. If not an object, treated as single value to
   *   replace "%%" in command string.
   * @returns {string}
   *   Serial command string intended to be outputted directly, empty string
   *   if error.
   */
  function gc(name, values) {
    var cmds = {
      units: 'G21 ;Set units to MM',
      abs: 'G90 ;Use Absolute units',
      home: 'G28 X0 Y0 ;Home All Axis',
      move: 'G00 X%x Y%y',
      speed: 'G1 F%% ;Set Speed',
      pumpon: 'M106 ;Pump on',
      pumpoff: 'M107 ;Pump off',
      change: 'M142 ;Bottle change', // TODO: This code is currently unknown!
      note: ';%%',
      wait: 'G4 P%% ;Pause for %% milliseconds',
      workspace: 'W1 X%x Y%y L%l T%t ;Define Workspace of this file', // Also made up
      off: 'M84 ;Motors off'
    };
    if (!name || !cmds[name]) return ''; // Sanity check
    var out = cmds[name];

    if (typeof values === 'object') {
      for(var v in values) {
        out = out.replace(new RegExp('%' + v, 'g'), values[v]);
      }
    } else if (typeof values !== 'object') { // Single item replace
      out = out.replace(new RegExp('%%', 'g'), values);
    }

    return out + "\n";
  }

  // Convert all closed paths in a layer to open, with a duplicate start
  // segement at the end (must be done after fill conversion is done).
  function convertAllClosedPaths(layer) {
    _.each(layer.children, function(path){
      if (path.closed) {
        path.closed = false;
        path.add(path.firstSegment.point);
      }
    });
  }

  // Convert an input Paper.js coordinate to an output bot mapped coordinate
  function reMap(p) {
    if (!p) {
      console.error('Null Point given for remap!');
      return {x: 0, y:0};
    }

    var pa = config.printArea;
    pa = {
      x: config.noMirror ? pa.x : pa.l,
      l: config.noMirror ? pa.l : pa.x,
      y: pa.y,
      t: pa.t
    }

    var b = paper.view.bounds;
    return {
      x: Math.round(map(b.width - (p.x - b.x), 0, b.width, pa.x, pa.l) * 1000) / 1000,
      y: Math.round(map(p.y - b.y, 0, b.height, pa.t, pa.y) * 1000) / 1000
    };
  }

  // Map a value in a given range to a new range
  function map(x, inMin, inMax, outMin, outMax) {
    return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
  }

  // Order a layers children by top left travel path from tip to tail, reversing
  // path order where needed, grouped by data.color. Only works with paths,
  // not groups or compound paths as it needs everything on an even playing
  // field to be reordered.
  function travelSortLayer(layer) {
    var a = layer;

    if (a.children.count <= 1) return; // This doesn't need to be run

    // 1. Move through all paths, group into colors
    // 2. Move through each group, convert list of paths into sets of first and
    //    last segment points, ensure groups are sorted.
    // 3. Find the point closest to the top left corner. If it's an end, reverse
    //    the path associated, make the first point the next one to check, remove
    //    the points from the group.
    // 4. Rinse and repeat!

    // Prep the colorGroups, darkest to lightest.
    var sortedColors = ['color3', 'color2', 'color1', 'color0'];
    var colorGroups = {};
    _.each(sortedColors, function(colorName) {
      colorGroups[colorName] = [];
    })

    // Put each path in the sorted colorGroups, with its first and last point
    _.each(a.children, function(path){
      // TODO: Not sure why or when this happens, but it has been seen. All
      // paths that make it to this point should have color data assigned.
      if (typeof path.data.color === 'undefined') {
        // Default a non-colored path to 0.
        path.data.color = 0;
      }

      colorGroups['color' + path.data.color].push({
        path: path,
        points: [path.firstSegment.point, path.lastSegment.point]
      });
    });

    // Move through each color group, then each point set for distance
    var drawIndex = 0; // Track the path index to insert paths into on the layer
    _.each(colorGroups, function(group){
      var lastPoint = new Point(0, 0); // Last point, start at the corner
      var lastPath = null; // The last path worked on for joining 0 dist paths

      while(group.length) {
        var c = closestPointInGroup(lastPoint, group);

        // First segment, or last segment?
        if (c.closestPointIndex === 0) { // First
          // Set last point to the end of the path
          lastPoint = group[c.id].points[1];
        } else { // last
          // Reverse the path direction, so its first point is now the last
           group[c.id].path.reverse();

          // Set last point to the start of the path (now the end)
          lastPoint = group[c.id].points[0];
        }

        // If the distance between the lastPoint and the next closest point is
        // below a usable threshold, and our lastPoint is on a path,
        // we can make this more efficient by joining the two paths.
        if (c.dist < 7 && lastPath) {
          // Combine lastPath with this path (remove the remainder)
          lastPath.join(group[c.id].path);
        } else { // Non-zero distance, add as separate path
          // Insert the path to the next spot in the action layer.
          a.insertChild(drawIndex, group[c.id].path);
          lastPath = group[c.id].path;
        }

        group.splice(c.id, 1); // Remove it from the list of paths

        drawIndex++;
      }
    });
  }

  // Find the closest point to a given source point from an array of point groups.
  function closestPointInGroup(srcPoint, pathGroup) {
    var closestID = 0;
    var closestPointIndex = 0;
    var closest = srcPoint.getDistance(pathGroup[0].points[0]);

    _.each(pathGroup, function(p, index){
      _.each(p.points, function(destPoint, pointIndex){
        var dist = srcPoint.getDistance(destPoint);
        if (dist < closest) {
          closest = dist;
          closestID = index;
          closestPointIndex = pointIndex;
        }
      })
    });

    return {id: closestID, closestPointIndex: closestPointIndex, dist: closest};
  }

  return returnRenderer;
};
