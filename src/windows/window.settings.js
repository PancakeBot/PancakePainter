/**
 * @file This is the window node module for the advanced settings window
 * that supplies init and binding code for the PancakePainter window API.
 * Exports function returns a window control object that allows triggering on
 * init, show, and hide events.
 * We have full access to globals loaded in the mainWindow as needed, just
 * reference them below.
 **/
 /* globals $, mainWindow */

module.exports = function(context) {
  var settings = {};

  function bindButtons() {
    $('button', context).click(function() {
      switch(this.name) {
        case 'done':
          mainWindow.overlay.toggleWindow('settings', false);
          break;

        case 'reset':
          mainWindow.resetSettings();
          break;
      }
    });
  }

  /**
   * Window initialization callback, triggered on window import.
   */
  settings.init = function() {
    bindButtons();
  };

  /**
   * Window show event callback, triggered on window show.
   */
  settings.show = function() {

  };

  /**
   * Window hide event callback, triggered on window close.
   */
  settings.hide = function() {

  };

  return settings;
};
