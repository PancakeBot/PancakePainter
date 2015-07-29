/*
 * @file Menu "module", provides menu for Mac/darwin only.
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
      label: appName,
      submenu: [
        {
          label: t('menus:mac.about', {name: appName}),
          selector: 'orderFrontStandardAboutPanel:'
        },
        {
          type: 'separator'
        },
        {
          label: 'Services',
          submenu: []
        },
        {
          type: 'separator'
        },
        {
          label: t('menus:mac.hide', {name: appName}),
          accelerator: 'Command+H',
          selector: 'hide:'
        },
        {
          label: t('menus:mac.hideothers'),
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:'
        },
        {
          label: t('menus:mac.show'),
          selector: 'unhideAllApplications:'
        },
        {
          type: 'separator'
        },
        {
          label: t('menus:mac.quit'),
          accelerator: 'Command+Q',
          click: function () {
            app.quit();
          }
        }

      ]
    },
    {
      label: t('menus:file.title'),
      submenu: [
        {
          label: t('menus:file.new'),
          accelerator: 'Command+N',
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
          accelerator: 'Command+W',
          click: function () {
            // TODO: Add this
          }
        },
        {
          type: 'separator'
        },
        {
          label: t('menus:file.save'),
          accelerator: 'Command+S',
          click: function () {
            // TODO: Add this
          }
        },
        {
          label: t('menus:file.saveas'),
          accelerator: 'Command+Shift+S',
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
          accelerator: 'Command+R',
          click: function () {
            BrowserWindow.getFocusedWindow().reloadIgnoringCache();
          }
        },
        {
          label: 'Toggle DevTools',
          accelerator: 'Alt+Command+I',
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
          accelerator: 'Command+M',
          selector: 'performMiniaturize:'
        },
        {
          label: 'Close',
          accelerator: 'Command+W',
          selector: 'performClose:'
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
