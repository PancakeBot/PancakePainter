/**
 * @file This is a helper include for adding clipboard (copy/cut/paste/dupe)
 * support.
 **/
"use strict";
/*globals _ */

module.exports = function(paper) {
  var clipboard = {};

  var view = paper.view;
  var project = paper.project;
  var Point = paper.Point;

  // Array of paths to paste during a cut/copy.
  clipboard.data = [];

  /**
   * "Clipboard" copy: Duplicate a path selection into the data space.
   *
   * @param  {boolean} deleteSelection
   *   Pass true to delete the selection after copying.
   *
   * @return {undefined}
   */
  clipboard.copy = function(deleteSelection) {
    if (paper.selectRect) {
      clipboard.data = [];
      _.each(paper.selectRect.ppaths, function(path){
        clipboard.data.push(path.clone(false));
        if (deleteSelection) path.remove();
      });

      if (deleteSelection) {
        paper.fileChanged();
        paper.deselect();
        view.update();
      }
    }
  };

  /**
   * "Clipboard" paste: Duplicate and offset the paths saved in the data space.
   *
   * @return {undefined}
   */
  clipboard.paste = function() {
    if (clipboard.data.length) {
      // Deselect when pasting.
      paper.deselect();

      // Clone each path, put in the layer, offset it, and add to selection.
      _.each(clipboard.data, function(path){
        var pathCopy = path.clone(false);
        project.activeLayer.addChild(pathCopy);
        pathCopy.translate(new Point(25, 25));
        paper.selectAdd(pathCopy);
      });

      paper.fileChanged();
      view.update();
    }
  };

  /**
   * "Clipboard" duplication: Duplicate selected paths w/out saving data.
   *
   * @return {undefined}
   */
  clipboard.dupe = function() {
    if (paper.selectRect) {
      var newPaths = [];
      _.each(paper.selectRect.ppaths, function(path){
        newPaths.push(path.clone(true));
      });

      // Deselect to clear for selecting the new paths.
      paper.deselect();

      _.each(newPaths, function(path){
        path.translate(new Point(25, 25));
        paper.selectAdd(path);
      });

      paper.fileChanged();
      view.update();
    }
  };

  return clipboard;
};
