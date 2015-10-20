/*
 * @file Build task wrapper and cleanup code.
 * (electron-packager does most of the work)
 */

module.exports = function(grunt) {
  var log = grunt.log.writeln;
  var conf = grunt.config;
  var fs = require('./task-helpers')(grunt);
  var fsp = require('fs-plus');
  var path = require('path');

  grunt.registerTask('build-win', 'Build the release application for windows.', function(){
    log('Running electon-packager for win build...');
    grunt.task.run('electron:winbuild', 'build-win-icon');

    // If we're on Win32, go ahead and run create-windows-installer
    if (process.platform === 'win32') {
      if (fsp.existsSync(conf('create-windows-installer.outputDirectory'))) {
        fs.rm(conf('create-windows-installer.outputDirectory'));
      }

      grunt.task.run('build-win-install');
    }
  });

  grunt.registerTask('build-win-icon', 'Change out the icon on the built windows exe.', function(){
    log('Changing windows executable icon...');

    var done = this.async();
    var shellExePath = path.join('build', 'dist', conf('name') + '-win32-x64', conf('name') + '.exe');
    var iconPath = path.resolve('resources', 'win', 'app.ico');
    var rcedit = require('rcedit');

    return rcedit(shellExePath, {icon: iconPath}, done);
  });

  grunt.registerTask('build-win-install', 'Create Windows Installer.', function(){
    grunt.task.run('create-windows-installer:64', 'create-windows-installer:32', 'build-win-install-post');
  });

  grunt.registerTask('build-win-install-post', 'Create Windows installer post cleanup.', function(){
    log('Cleanup windows install...');
    ['32', '64'].map(function(arch) {
      var p = conf('create-windows-installer.' + arch + '.outputDirectory');
      fs.mv(p + 'Setup.exe', 'build/dist/Install_' + conf('name') + '_Win_' + arch + 'bit_v' + conf('pkg.version') + '.exe');
      fs.rm(p);
    });
  });

  grunt.registerTask('build-mac', 'Build the release application for OS X.', function(){
    grunt.task.run('electron:macbuild');

    // If we're on Mac, go ahead and run appdmg
    /*if (process.platform === 'darwin') {
      if (fsp.existsSync(conf('appdmg.target.dest'))) {
        fs.rm(conf('appdmg.target.dest'));
      }

      grunt.task.run('appdmg');
    }*/
  });
};
