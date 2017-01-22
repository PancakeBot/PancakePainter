/**
 * @file This is the window node module for the advanced settings window
 * that supplies init and binding code for the PancakePainter window API.
 * Exports function returns a window control object that allows triggering on
 * init, show, and hide events.
 * We have full access to globals loaded in the mainWindow as needed, just
 * reference them below.
 **/
 /* globals $, mainWindow, i18n, app,  */

module.exports = function(context) {
  var settings = {};


  function bindButtons() {


    $('button', context).click(function() {
      if (this.id === 'done') {
        mainWindow.overlay.toggleWindow('settings', false);
      } else if (this.id === 'reset') {
        var doReset = mainWindow.dialog({
          t: 'MessageBox',
          type: 'question',
          message: i18n.t('settings.resetconfirm'),
          detail: i18n.t('settings.resetconfirmdetail'),
          buttons: [
            i18n.t('common.button.cancel'),
            i18n.t('settings.button.reset')
          ]
        });
        if (doReset !== 0) {
          // Clear the file, reload settings, push to elements.
          app.settings.clear();
          app.settings.load();
          $('#settings .managed').each(function(){
            $(this).val(app.settings.v[this.id]);
            if (this.type === "checkbox") {
              $(this).prop('checked', app.settings.v[this.id]);
            } else {
              $(this).val(app.settings.v[this.id]);
            }
          });
          setRenderSettings();
          $('input[type="range"]').rangeslider('update', true);
        }
      }
    });
  }



  settings.init = function() {
    bindButtons();
  };

  settings.show = function() {

  };

  settings.hide = function() {

  };

  return settings;
};
