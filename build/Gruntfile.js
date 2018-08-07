var path = require('path');

module.exports = function(grunt) {
  // Load the plugins...
  grunt.loadNpmTasks('grunt-electron');

  // Load all platform specific tasks:
  switch (process.platform) {
    case 'win32':
      break;

    case 'darwin':
      grunt.loadNpmTasks('grunt-appdmg');
      break;

    default:
      grunt.loadNpmTasks('grunt-electron-installer-debian');
      grunt.loadNpmTasks('grunt-electron-installer-redhat');
      break;
  }


  // Load the tasks in '/tasks'
  grunt.loadTasks('tasks');

  // Set all subsequent paths to the relative to the root of the repo
  grunt.file.setBase(path.resolve('..'));

  var appInfo = grunt.file.readJSON('package.json');
  var version = appInfo.version;
  var electronVer = appInfo.electronVersion; // Electron build version
  var numericVersion = appInfo.version.split('-')[0];
  var buildIgnore = [
    'build/dist',
    'build/node_modules',
    'build/tasks',
    'build/package.json',
    'build/Gruntfile.js',
    'node_modules/electron-prebuilt',
    'node_modules/grunt*'
  ].join('|');

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
          'osx-sign': {
            identity: 'Developer ID Application: StoreBound LLC (AEJ8NZZ3TC)'
          },
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
            LegalCopyright: appInfo.copyright,
            FileDescription: appInfo.name,
            OriginalFilename: appInfo.name + '.exe',
            FileVersion: electronVer,
            ProductVersion: version,
            ProductName: appInfo.name,
            InternalName: appInfo.name
          }
        }
      },
      linbuild: {
        options: {
          name: appInfo.name,
          dir: './',
          out: 'build/dist',
          icon: 'resources/app.png',
          ignore: buildIgnore,
          version: appInfo.electronVersion,
          platform: 'linux',
          arch: 'x64',
          'app-version': appInfo.version,
          overwrite: true,
          prune: true
        }
      },
    },
    appdmg: {
      options: {
        basepath: 'build/dist/' + appInfo.name + '-darwin-x64',
        title: 'Install ' + appInfo.releaseInfo.appName,
        icon: '../../../resources/darwin/app.icns',
        background: '../../../resources/darwin/dmg_back.png',
        'icon-size': 80,
        contents: [
          {x: 448, y: 344, type: 'link', path: '/Applications'},
          {x: 192, y: 344, type: 'file', path: appInfo.releaseInfo.appName +'.app'}
        ]
      },
      target: {
        dest:
          'build/dist/' +
           appInfo.releaseInfo.appName +
           '_Mac_v' + appInfo.version + '.dmg'
      }
    },
    'create-windows-installer': {
      64: {
        iconUrl: appInfo.iconURL,
        appDirectory: 'build/dist/PancakePainter-win32-x64',
        outputDirectory: 'build/dist/winstall64/',
        loadingGif: 'resources/win32/install_anim.gif',
        version: numericVersion,
        authors: 'PancakeBot Inc.'
      },
      32: {
        iconUrl: appInfo.iconURL,
        appDirectory: 'build/dist/PancakePainter-win32-ia32',
        outputDirectory: 'build/dist/winstall32/',
        loadingGif: 'resources/win32/install_anim.gif',
        version: numericVersion,
        authors: 'PancakeBot Inc.'
      }
    },
    'electron-installer-debian': {
      options: {
        name: appInfo.name,
        productName: appInfo.releaseInfo.appName,
        description: appInfo.description,
        productDescription: appInfo.releaseInfo.description,
        genericName: 'Robot Controller',
        section: 'graphics',
        priority: 'optional',
        version: numericVersion,
        revision: appInfo.version.split('-')[1],
        categories: appInfo.releaseInfo.categories,
        lintianOverrides: [
          'changelog-file-missing-in-native-package',
          'executable-not-elf-or-script',
          'extra-license-file'
        ]
      },
      linux64: {
        options: {
          icon: 'resources/app.png',
          arch: 'amd64'
        },
        src: 'build/dist/' + appInfo.name + '-linux-x64',
        dest: 'build/dist/'
      }
    },
    'electron-installer-redhat': {
      options: {
        name: appInfo.name,
        productName: appInfo.releaseInfo.appName,
        description: appInfo.description,
        productDescription: appInfo.releaseInfo.description,
        genericName: 'Robot Controller',
        categories: appInfo.releaseInfo.categories,
        version: numericVersion,
        revision: appInfo.version.split('-')[1],
      },
      linux64: {
        options: {
          arch: 'x86_64',
          icon: 'resources/app.png',
        },
        src: 'build/dist/' + appInfo.name + '-linux-x64',
        dest: 'build/dist/'
      }
    },
  });


  // Default task(s).
  grunt.registerTask('default', ['build']);
};
