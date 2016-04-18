/**
 * @file This is a helper include for adding undo/redo functionality for the
 * Paper.JS canvas drawing area.
 **/
 /*globals _ */

 module.exports = function(paper) {
   var undo = {};
   var project = paper.project;
   var view = paper.view;

   undo.options = {
     undoLevels: 20
   };

   // Define the undo object's storage and methods.
   undo.data = [];
   undo.index = 0; // The index of undo, almost always 0 (the tip of changes).

   /**
    * Trigger a state change, and save it to the undo history list.
    * @return {undefined}
    */
   undo.stateChanged = function(){
     // If we're not at the tip of the undo, this now becomes the new tip,
     // erasing the data in front of it.
     if (this.index !== 0) {
       this.data.splice(0, this.index);
       this.index = 0;
     }

     // Add the new data to the beggining of the array.
     this.data.unshift(this.getState());

     // When we have more data than we should, trim it off the end.
     if (this.data.length > this.options.undoLevels) {
       this.data.splice(-1, 1);
     }
   };

   /**
    * Clear the state of the undo history completely, on new document or open.
    * @return {undefined}
    */
   undo.clearState = function() {
     this.data = [];
     this.index = 0;
     this.stateChanged();
   };

   /**
    * Move backwards in the undo history from current index until end of history
    * @return {undefined}
    */
   undo.goBack = function() {
     // Can't go past the length of the data we have.
     if (this.index < this.data.length - 1) {
       this.index++;
       this.setState();
     }
   };

   /**
    * Move forward in the undo history from current index until start of history
    * @return {undefined}
    */
   undo.goForward = function() {
     // Can't go past the length of the data we have.
     if (this.index > 0) {
       this.index--;
       this.setState();
     }
   };

   /**
    * Get the current JSON "state" dump of the image, manages selections.
    *
    * @return {string}
    *   JSON content of the entire canvas & layers to be read back by setState.
    */
   undo.getState = function() {
     var reSelect = null;
     if (paper.selectRect) {
       reSelect = paper.selectRect.ppath;
       paper.selectRect.remove();
       paper.selectRect = null;
     }

     var state = project.exportJSON();

     if (reSelect) {
       paper.selectPath(reSelect);
     }

     return state;
   };

   /**
    * Set the state of the canvas to the current index of the undo dataset.
    * @return {undefined}
    */
   undo.setState = function() {
     paper.emptyProject();
     project.importJSON(this.data[this.index]);

     paper.imageLayer = project.layers[0];
     paper.mainLayer = project.layers[1];
     paper.mainLayer.activate();

     // Reinstate traceImage, if any.
     if (paper.imageLayer.children.length) {
       paper.traceImage = paper.imageLayer.children[0];
       paper.traceImage.img = paper.traceImage.children[0];
     }

     view.update();
   };

   // Set the initial state!
   undo.stateChanged();

   // Give the main object back to the parent module.
   return undo;
 };
