/*
 * @file Menu "module", provides menu for Windows/win32 only.
 */
"use strict";
module.exports = function applyTemplate(t) {
  var app = require('app');
  var BrowserWindow = require('browser-window');
  var Menu = require('menu');
  var path = require("path");
  var packageData = require(path.join(app.getAppPath(), 'package.json'));
  var appName = packageData.name;

  var template = [
    {
      label: t('menus:file.title'),
      submenu: [
        {
          label: t('menus:file.new'),
          accelerator: 'Control+N',
          click: function () {
            // TODO: Add this
          }
        },
        {
          label: t('menus:file.open'),
          accelerator: 'o',
          click: function () {
            // TODO: Add this
          }
        },
        {
          type: 'separator'
        },
        {
          label: t('menus:file.close'),
          accelerator: 'Control+W',
          click: function () {
            // TODO: Add this
          }
        },
        {
          type: 'separator'
        },
        {
          label: t('menus:file.save'),
          accelerator: 'Control+S',
          click: function () {
            // TODO: Add this
          }
        },
        {
          label: t('menus:file.saveas'),
          accelerator: 'Control+Shift+S',
          click: function () {
            // TODO: Add this
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Control+R',
          click: function () {
            BrowserWindow.getFocusedWindow().reloadIgnoringCache();
          }
        },
        {
          label: 'Toggle DevTools',
          accelerator: 'Alt+Control+I',
          click: function () {
            BrowserWindow.getFocusedWindow().toggleDevTools();
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Control+M',
          selector: 'performMiniaturize:'
        }
      ]
    },
    {
      label: 'Help',
      submenu: []
    }
  ];


  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  return template;
};
