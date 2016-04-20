/**
 * @file Menu "module" handler root. Figures out which menu to display for the
 * given operating system and translates keys into labels.
 **/
"use strict";
module.exports = function menuInit(app) {
  var remote = require('remote');
  var Menu = remote.require('menu');
  var i18n = remote.require('i18next');
  var _ = require('underscore');

  var platform = process.platform;

  // Only 2 supported platforms at the moment
  if (platform !== 'win32' && platform !== 'darwin') {
    platform = 'win32'; // Default to windows menu
  }

  var mainMenu = require('../menus/menu-' + platform)();

  // Pre-process then apply menu to the window
  _.each(mainMenu, function(menu){
    // Translate key to label for top level menus
    if (menu.key) menu.label = i18n.t('menus:' + menu.key, menu.var);

    _.each(menu.submenu, function(sub){
      if (sub.key) {
        // Translate key to label for submenus
        sub.label = i18n.t('menus:' + sub.key, sub.var);
        if (!sub.click) {
          // Add generic click event only if not already bound
          sub.click = function(e) {
            app.menuClick(e.key);
          };
        }
      }
    });
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(mainMenu));
};
