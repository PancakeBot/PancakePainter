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

  // Tool identification (for building out tool palette)
  tool.name = 'tools.fill';
  tool.key = 'fill';
  tool.cursorOffset = '1 9'; // Position for cursor point


  return tool;
};
