module.exports = function(grunt) {

  grunt.initConfig({
    sass: {                              // Task
      dist: {                            // Target
        options: {                       // Target options
          style: 'expanded'
        },
        files: {                         // Dictionary of files
          'src/styles/index.css': 'src/styles/index.scss'
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-sass');


  // Default task(s).
  grunt.registerTask('default', ['sass']);
};
