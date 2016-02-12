/*
 * @file Menu "module", provides menu for Mac/darwin only.
 */
"use strict";
module.exports = function applyTemplate() {
  var remote = require('remote');
  var app = remote.require('app');
  var BrowserWindow = remote.require('browser-window');
  var path = require('path');
  var packageData = require(path.join(app.getAppPath(), 'package.json'));
  var appName = packageData.name;

  var template = [
    {
      label: appName,
      submenu: [
        {
          key: 'mac.about',
          var: {name: appName},
          selector: 'orderFrontStandardAboutPanel:'
        },
        {
          type: 'separator'
        },
        {
          key: 'mac.services',
          submenu: []
        },
        {
          type: 'separator'
        },
        {
          key: 'mac.hide',
          var: {name: appName},
          accelerator: 'Command+H',
          selector: 'hide:'
        },
        {
          key: 'mac.hideothers',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:'
        },
        {
          key: 'mac.show',
          selector: 'unhideAllApplications:'
        },
        {
          type: 'separator'
        },
        {
          key: 'mac.quit',
          accelerator: 'Command+Q',
          click: function () {
            app.quit();
          }
        }

      ]
    },
    {
      key: 'file.title',
      submenu: [
        {
          key: 'file.new',
          accelerator: 'Command+N'
        },
        {
          key: 'file.open',
          accelerator: 'o'
        },
        {
          type: 'separator'
        },
        {
          key: 'file.close',
          accelerator: 'Command+W'
        },
        {
          type: 'separator'
        },
        {
          key: 'file.export',
          accelerator: 'Command+E'
        },
        {
          key: 'file.exportmirrored',
          accelerator: 'Command+Shift+E'
        },
        {
          key: 'file.save',
          accelerator: 'Command+S'
        },
        {
          key: 'file.saveas',
          accelerator: 'Command+Shift+S'
        }
      ]
    },
    {
      key: 'view.title',
      submenu: [
        {
          key: 'view.settings',
          accelerator: 'Shift+Alt+S'
        },
        {
          key: 'view.reload',
          accelerator: 'Command+R',
          click: function () {
            BrowserWindow.getFocusedWindow().reloadIgnoringCache();
          }
        },
        {
          key: 'view.toggle',
          accelerator: 'Alt+Command+I',
          click: function () {
            BrowserWindow.getFocusedWindow().toggleDevTools();
          }
        }
      ]
    },
    {
	  key: 'window.title',
      submenu: [
        {
          key: 'window.minimize',
		  accelerator: 'Command+M',
          selector: 'performMiniaturize:'
        },
        {
          key: 'window.close',
          accelerator: 'Command+W',
          selector: 'performClose:'
        }
      ]
    }
  ];

  return template;
};
