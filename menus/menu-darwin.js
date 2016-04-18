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
      key: 'edit.title',
      submenu: [
        {
          key: 'edit.undo',
          accelerator: 'Command+z'
        },
        {
          key: 'edit.redo',
          accelerator: 'Command+Shift+z'
        },
        {
          type: 'separator'
        },
        {
          key: 'edit.cut',
          accelerator: 'Command+x'
        },
        {
          key: 'edit.copy',
          accelerator: 'Command+c'
        },
        {
          key: 'edit.paste',
          accelerator: 'Command+v'
        },
        {
          key: 'edit.duplicate',
          accelerator: 'Command+d'
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          key: 'view.settings',
          accelerator: 'Shift+Alt+S'
        },
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
    }
  ];

  return template;
};
