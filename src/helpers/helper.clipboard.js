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
        var tracing = paper.getTracedImage(path);
        if(tracing) {
          var newCompounds = [];
          _.each(tracing, function(compound){
            if(copiedGroups.indexOf(compound.id) < 0){
              var clone = compound.clone(false);
              clone.position = compound.position;
              clone.scaling = compound.scaling;
              clone.rotation = compound.rotation;
              clone.name = 'traced path';

              _.each(clone.children, function (item) {
                item.name = 'traced path';
              });

              copiedGroups.push(compound.id);
              newCompounds.push(clone);

              if (deleteSelection) compound.remove();
            }
          });

          // Push the array with all the compounds of this traced image
          clipboard.data.push(newCompounds);
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
        // If this is an array it's a group of compounds
        //  of a traced image
        if(path instanceof Array){
          var imageId = paper.getRandomInt(0, 10000);
          _.each(path, function (compound) {
            var compoundCopy = compound.clone(false);
            compoundCopy.position = compound.position;
            compoundCopy.scaling = compound.scaling;
            compoundCopy.rotation = compound.rotation;
            compoundCopy.name = 'traced path';
            compoundCopy.data.imageId = imageId;
            
            _.each(compoundCopy.children, function (item) {
              item.name = 'traced path';
            });
            
            project.activeLayer.addChild(compoundCopy);
            compoundCopy.translate(new Point(25, 25));
            paper.selectAdd(compoundCopy);
          });
        }
        else {
          var pathCopy = path.clone(false);

          project.activeLayer.addChild(pathCopy);
          pathCopy.translate(new Point(25, 25));
          paper.selectAdd(pathCopy);
        }
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
        var tracing = paper.getTracedImage(path);
        if(tracing) {
          var imageId = paper.getRandomInt(0, 10000);
          _.each(tracing, function(compound){
            if(copiedGroups.indexOf(compound.id) < 0){
              var clone = compound.clone(false);
              clone.position = compound.position;
              clone.scaling = compound.scaling;
              clone.rotation = compound.rotation;
              clone.name = 'traced path';
              clone.data.imageId = imageId;

              _.each(clone.children, function (item){
                item.name = 'traced path';
              });

              copiedGroups.push(compound.id);
              newPaths.push(clone);
            }
          });
        }
        else {
          newPaths.push(path.clone(false));
        }
      });

      // Deselect to clear for selecting the new paths.
      paper.deselect();

      _.each(newPaths, function(path){
        project.activeLayer.addChild(path);
        path.translate(new Point(25, 25));
        paper.selectAdd(path);
      });

      paper.fileChanged();
      view.update();
    }
  };

  return clipboard;
};
