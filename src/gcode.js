/**
 * @file This file contains the abstractions required for rendering the Paper.js
 * paths into GCODE compatible with the PancakeBot.
 **/
"use strict";

module.exports = function(config) {
  var paper = config.paper;
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

      // Trigger color change
      if (colorGroups[groupIndex+1]) {
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
      gc('note', 'Nearing path end, moving to preshutoff'),
      gc('move', reMap(path.getPointAt(offset))),
      gc('pumpoff')
    ].join('');

    // Render segment points to Gcode movements
    _.each(path.segments, function(segment, index){
      out+= gc('move', reMap(segment.point)); // Start by moving to this path segment

      if (index === 0) { // First path segment
        // After we've moved to the point, start the pump and wait for it to warm up
        out+= [gc('pumpon'), gc('wait', config.startWait), ''].join('');
      } else if (index === path.segments.length-1) { // Last path segment
        // When the path is closed, we're actually missing the last point,
        // so we need to add it manually
        if (path.closed) {
          // If we haven't shut off the pump yet, we need to do that
          if (!pumpOff) {
            pumpOff = true;
            out+= gcPreShutoff;
          }

          // Move to last position on the path
          out+= gc('move', reMap(path.getPointAt(path.length)));
        }

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
      gc('note', 'PancakePainter footer start'),
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
      gc('wait', 5000),
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

  return returnRenderer;
};
