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
      var copiedGroups = [];

      _.each(paper.selectRect.ppaths, function(path){
        if(path.name !== 'traced path'){
          clipboard.data.push(path.clone(false));
          if (deleteSelection) path.remove();
        }
        // If traced path was selected, copy the entire group
        //  and keep trace of it so we don't copy it more than
        //  once
        else if(path.parent.className == 'Group' &&
            path.parent.name == 'traced path' &&
            copiedGroups.indexOf(path.parent.id) < 0) {
          var clone = path.parent.clone(false);
          clone.name = 'traced path';
          _.each(clone.children, function (item) {
            item.name = 'traced path';
          });

          copiedGroups.push(path.parent.id);
          clipboard.data.push(clone);
          if (deleteSelection) path.parent.remove();
        }
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

        // If this is a traced path this should be a group, we shouldn't
        //  never get a traced Path here, only the group
        if(path.name == 'traced path' &&
            path.className == 'Group'){
          _.each(pathCopy.children, function (item) {
            item.name = 'traced path';
          });
        }

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
      var copiedGroups = [];

      _.each(paper.selectRect.ppaths, function(path){
        if(path.parent.className == 'Group' &&
            path.parent.name == 'traced path' &&
            copiedGroups.indexOf(path.parent.id) < 0) {

          var clone = path.parent.clone();
          clone.name = 'traced path';
          _.each(clone.children, function (item) {
            item.name = 'traced path';
          });
          copiedGroups.push(path.parent.id);
          newPaths.push(clone);
        }
        else {
          newPaths.push(path.clone(true));
        }
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
