var path = require('path');

module.exports = function(grunt) {
  // Load the plugins...
  grunt.loadNpmTasks('grunt-electron');
  if (process.platform === 'win32') grunt.loadNpmTasks('grunt-electron-installer');
  //if (process.platform === 'darwin') grunt.loadNpmTasks('grunt-appdmg');

  // Load the tasks in '/tasks'
  grunt.loadTasks('tasks');

  // Set all subsequent paths to the relative to the root of the repo
  grunt.file.setBase(path.resolve('..'));

  var appInfo = grunt.file.readJSON('package.json');
  var version = appInfo.version;
  var electronVer = appInfo.electronVersion; // Electron build version
  var numericVersion = appInfo.version.split('-')[0];
  var buildIgnore = 'build/dist|build/node_modules|build/tasks|build/package.json|build/Gruntfile.js';

  // Project configuration.
  grunt.initConfig({
    name: appInfo.name,
    pkg: appInfo,
    electron: {
      macbuild: {
        options: {
          name: appInfo.name,
          dir: './',
          out: 'build/dist',
          icon: 'resources/darwin/app.icns',
          version: electronVer,
          platform: 'darwin',
          arch: 'x64',
          ignore: buildIgnore,
          'app-version': version,
          overwrite: true,
          prune: true,
          'app-bundle-id': 'pancakepainter-main',
          'helper-bundle-id': 'pancakepainter-helper'
        }
      },
      winbuild: {
        options: {
          name: appInfo.name,
          dir: './',
          out: 'build/dist',
          icon: 'resources/win32/app.ico',
          version: electronVer,
          platform: 'win32',
          arch: 'x64,ia32',
          ignore: buildIgnore,
          'app-version': version,
          overwrite: true,
          prune: true,
          'version-string': {
            CompanyName: 'PancakeBot Inc.',
            LegalCopyright: 'Copyright (C) PancakeBot Inc., all rights reserved. Code under Apache v2.0 free and open source license.',
            FileDescription: appInfo.name,
            OriginalFilename: appInfo.name + '.exe',
            FileVersion: electronVer,
            ProductVersion: version,
            ProductName: appInfo.name,
            InternalName: appInfo.name
          }
        }
      }
    },
    'create-windows-installer': {
      64: {
        iconUrl: "http://raw.githubusercontent.com/PancakeBot/PancakePainter/master/resources/win32/app.ico",
        appDirectory: 'build/dist/PancakePainter-win32-x64',
        outputDirectory: 'build/dist/winstall64/',
        loadingGif: 'resources/win32/install_anim.gif',
        version: numericVersion,
        authors: 'PancakeBot Inc.'
      },
      32: {
        iconUrl: "http://raw.githubusercontent.com/PancakeBot/PancakePainter/master/resources/win32/app.ico",
        appDirectory: 'build/dist/PancakePainter-win32-ia32',
        outputDirectory: 'build/dist/winstall32/',
        loadingGif: 'resources/win32/install_anim.gif',
        version: numericVersion,
        authors: 'PancakeBot Inc.'
      }
    },
  });


  // Default task(s).
  grunt.registerTask('default', ['pre-build']);
};
