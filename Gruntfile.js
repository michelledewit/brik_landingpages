var LIVERELOAD_PORT = 35729;

module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        paths: grunt.file.readJSON('paths.json'),

        sass: {
            options: {
                includePaths: [
                    '<%= paths.bower_components %>/foundation-sites/scss',
                    '<%= paths.bower_components %>'
                ],
                sourceMap: false
            },
            dist: {
                options: {
                    outputStyle: 'compressed'
                    //outputStyle: 'nested'

                },
                files: {
                    '<%= paths.public %>/<%= paths.assets.styles %>/app.css': '<%= paths.source.sass %>/app.scss'
                }
            }
        },

        bake: {
            dist: {
                options: {
                    content: '<%= paths.source.templates %>/content.json',
                    section: 'default'
                },
                files: {
                    '<%= paths.public %>/<%= paths.assets.html %>/index.html': '<%= paths.source.templates %>/index.html',
                    '<%= paths.public %>/<%= paths.assets.html %>/temp.html': '<%= paths.source.templates %>/temp.html',
                    '<%= paths.public %>/<%= paths.assets.html %>/detail.html': '<%= paths.source.templates %>/detail.html',
                    '<%= paths.public %>/<%= paths.assets.html %>/contentDetail.html': '<%= paths.source.templates %>/contentDetail.html',
                    '<%= paths.public %>/<%= paths.assets.html %>/detail-nolayout.html': '<%= paths.source.templates %>/detail-nolayout.html',
                    '<%= paths.public %>/<%= paths.assets.html %>/jobs.html': '<%= paths.source.templates %>/jobs.html',
                    '<%= paths.public %>/<%= paths.assets.html %>/job.html': '<%= paths.source.templates %>/job.html'
                }
            },
        },

        connect: {
            server: {
                options: {
                    port: 9002,
                    livereload: true,
                    base: '<%= paths.public %>'
                },
            }
        },

        watch: {
            grunt: {files: ['Gruntfile.js']},

            sass: {
                files: '<%= paths.source.sass %>/**/*.scss',
                tasks: ['sass']
            }
        },

        watch: {
            compile: {
                //files: [
                //    '<%= paths.source.sass %>/**/*.scss', 
                //    '<%= paths.source.templates %>/**/*.html',
                //    '<%= paths.source.js %>/**/*.js',
                //    '<%= paths.source.templates %>/content.json'
                //],
                //tasks: ['sass', 'concat', 'uglify', 'bake', 'prettify:html', 'replace:assets'],
                files: [
                    '<%= paths.source.sass %>/**/*.scss',
                    '<%= paths.source.stylesheets %>/**/*.css',
                    '<%= paths.source.scripts %>/**/*.js',
                    '<%= paths.source.templates %>/**/*.html'

                ],
                tasks: ['sass', 'bake', 'replace', 'concat'/*, 'babel'*/],
                options: {
                    livereload: true,
                },
            }
        },

        autoprefixer: {

            options: {
                browsers: ['last 3 versions', 'ie 9', 'iOS 7']
            },

            no_dest: {
                src: '<%= paths.public %>/<%= paths.assets.styles %>/app.css'
            }
        },


        browserSync: {
            dev: {
                bsFiles: {
                    src: ['<%= paths.public %>/<%= paths.assets.styles %>/*.html', '<%= paths.public %>/<%= paths.assets.html %>/*.html']
                },
                options: {
                    proxy: "0.0.0.0:9002",
                    watchTask: true
                }
            }
        },

        replace: {
            assets: {
                src: [
                    '<%= paths.public %>/<%= paths.assets.styles %>/**/*.css',
                    '<%= paths.public %>/<%= paths.assets.html %>/**/*.html',
                    '<%= paths.public %>/<%= paths.assets.scripts %>/**/*.js'
                ],
                overwrite: true, // overwrite matched source files
                replacements: [
                    {from: "{path.styles}", to: "/<%= paths.assets.styles %>"},
                    {from: "{path.scripts}", to: "/<%= paths.assets.scripts %>"},
                    {from: "{path.images}", to: "/<%= paths.assets.images %>"},
                    {from: "{path.html}", to: "/<%= paths.assets.html %>"},
                    {from: "{path.fonts}", to: "/<%= paths.assets.fonts %>"},
                    {from: "{path.videos}", to: "/<%= paths.assets.videos %>"},
                ]
            }
        },

        copy: {
            fonts: {
                files: [
                    // includes files within path
                    {
                        expand: true,
                        cwd: '<%= paths.source.fonts %>/',
                        src: ['**'],
                        dest: '<%= paths.public %>/<%= paths.assets.fonts %>/',
                        filter: 'isFile'
                    },
                ]
            },
            images: {
                files: [
                    // includes files within path
                    {
                        expand: true,
                        cwd: '<%= paths.source.images %>/',
                        src: ['**'],
                        dest: '<%= paths.public %>/<%= paths.assets.images %>/',
                        filter: 'isFile'
                    },
                ]
            },
            videos: {
                files: [
                    // includes files within path
                    {
                        expand: true,
                        cwd: '<%= paths.source.videos %>/',
                        src: ['**'],
                        dest: '<%= paths.public %>/<%= paths.assets.videos %>/',
                        filter: 'isFile'
                    },
                ]
            },
            javascript: {
                files: [
                    // includes files within path
                    {expand: true, cwd: '<%= paths.source.scripts %>/', src: ['scrollMonitor.js'], dest: '<%= paths.public %>/<%= paths.assets.scripts %>/', filter: 'isFile'},
                ]
            },
            stylesheets: {
                files: [
                    // includes files within path
                    {
                        expand: true,
                        cwd: '<%= paths.source.stylesheets %>/',
                        src: ['**'],
                        dest: '<%= paths.public %>/<%= paths.assets.styles %>/',
                        filter: 'isFile'
                    },
                ]
            }
        },

        imagemin: {                          // Task
            dynamic: {
                options: {                       // Target options
                    optimizationLevel: 6,
                },                        // Another target
                files: [{
                    expand: true,                  // Enable dynamic expansion
                    cwd: '<%= paths.source.images %>/',                   // Src matches are relative to this path
                    src: ['**/*.{png,jpg,gif}'],   // Actual patterns to match
                    dest: '<%= paths.public %>/<%= paths.assets.images %>/'                  // Destination path prefix
                }]
            }
        },

        // modernizr: {
        //
        //     dist: {
        //         // [REQUIRED] Path to the build you're using for development.
        //         "devFile": "<%= paths.source.scripts %>/modernizr-2-8-3.js",
        //
        //         // [REQUIRED] Path to save out the built file.
        //         "outputFile": "<%= paths.public %>/<%= paths.assets.scripts %>/modernizr-custom.js",
        //
        //
        //         // By default, source is uglified before saving
        //         "uglify": true,
        //
        //         // By default, this task will crawl your project for references to Modernizr tests.
        //         // Set to false to disable.
        //         "parseFiles": true,
        //
        //         // When parseFiles = true, this task will crawl all *.js, *.css, *.scss files, except files that are in node_modules/.
        //         // You can override this by defining a "files" array below.
        //         "files": {
        //             src: [
        //                 '<%= paths.public %>/<%= paths.assets.scripts %>/**/*.js',
        //                 '<%= paths.public %>/<%= paths.assets.styles %>/**/*.css',
        //             ]
        //         }
        //     }
        //
        // },

        fontello: {
            dist: {
                options: {
                    config: '<%= paths.source.settings %>/config.json',
                    fonts: '<%= paths.source.fonts %>',
                    styles: '<%= paths.source.sass %>/fontello',
                    scss: true,
                    force: true
                }
            }
        },

        favicons: {
            options: {
                trueColor: true,
                precomposed: false,
                appleTouchBackgroundColor: "#ffffff",
                coast: true,
                windowsTile: true,
                tileBlackWhite: false,
                tileColor: "auto",
                html: '<%= paths.public %>/<%= paths.assets.html %>/index.html',
                HTMLPrefix: "/<%= paths.assets.images %>/icons/"
            },
            icons: {
                src: '<%= paths.source.favicon %>/favicon.png',
                dest: '<%= paths.public %>/<%= paths.assets.images %>/icons'
            }
        },

        concat: {
            base: {
                src: [
                    //'<%= paths.bower_components %>/jquery/dist/jquery.js',
                    //'<%= paths.bower_components %>/foundation-sites/dist/js/plugins/foundation.core.js',
                    // '<%= paths.bower_components %>/foundation-sites/dist/js/plugins/foundation.util.motion.js',
                    // '<%= paths.bower_components %>/foundation-sites/dist/js/plugins/foundation.util.nest.js',
                    // '<%= paths.bower_components %>/foundation-sites/dist/js/plugins/foundation.util.box.js',
                    //'<%= paths.bower_components %>/foundation-sites/dist/js/plugins/foundation.util.keyboard.js',
                    // '<%= paths.bower_components %>/foundation-sites/dist/js/plugins/foundation.util.mediaQuery.js',
                    // '<%= paths.bower_components %>/foundation-sites/dist/js/plugins/foundation.util.triggers.js',
                    // '<%= paths.bower_components %>/foundation-sites/dist/js/plugins/foundation.dropdownMenu.js',
                    // '<%= paths.bower_components %>/foundation-sites/dist/js/plugins/foundation.drilldown.js',
                    // '<%= paths.bower_components %>/foundation-sites/dist/js/plugins/foundation.abide.js',
                    // '<%= paths.bower_components %>/foundation-sites/dist/js/plugins/foundation.offcanvas.js',
                    // '<%= paths.bower_components %>/foundation-sites/dist/js/plugins/foundation.tabs.js',
                    // '<%= paths.bower_components %>/foundation-sites/dist/js/plugins/foundation.toggler.js',
                    // '<%= paths.bower_components %>/foundation-sites/dist/js/plugins/foundation.tooltip.js',
                    //'<%= paths.bower_components %>/slick-carousel/slick/slick.js',
                    // '<%= paths.bower_components %>/magnific-popup/src/js/core.js',
                    // '<%= paths.bower_components %>/magnific-popup/src/js/inline.js',
                    // '<%= paths.bower_components %>/magnific-popup/src/js/iframe.js',
                    // '<%= paths.bower_components %>/magnific-popup/src/js/ajax.js',
                    // '<%= paths.bower_components %>/magnific-popup/src/js/image.js',
                    // '<%= paths.bower_components %>/magnific-popup/src/js/gallery.js',
                    //'<%= paths.bower_components %>/axios/dist/axios.js',
                    '<%= paths.source.scripts %>/es6-promise.js',
                    '<%= paths.source.scripts %>/es6-promise.auto.js',
                    '<%= paths.source.scripts %>/axios.js',
                    '<%= paths.source.scripts %>/lazysizes.js',
                    '<%= paths.source.scripts %>/lory.js',
                    '<%= paths.source.scripts %>/pristine.js',
                    '<%= paths.source.scripts %>/toolbox.js',
                    '<%= paths.source.scripts %>/canvi.js',
                    '<%= paths.source.scripts %>/smooth-parallax.js',
                    '<%= paths.source.scripts %>/sticky.js',
                    '<%= paths.source.scripts %>/app.js'],
                dest: '<%= paths.public %>/<%= paths.assets.scripts %>/app.js'
            }
        },

        uglify: {
            my_target: {
                files: {
                    '<%= paths.public %>/<%= paths.assets.scripts %>/app.min.js': ['<%= paths.public %>/<%= paths.assets.scripts %>/app.js']
                }
            }
        },
        babel: {
            options: {
                sourceMap: true,
                presets: ['es2015']
            },
            dist: {
                files: {
                    '<%= paths.public %>/<%= paths.assets.scripts %>/app.js': '<%= paths.public %>/<%= paths.assets.scripts %>/app.js'
                }
            }
        },

        uncss: {
            dist: {
                files: {
                    '<%= paths.public %>/<%= paths.assets.styles %>/app.min.css': ['<%= paths.public %>/<%= paths.assets.html %>/index.html']
                }
            }
        },

        purgecss: {
            my_target: {
                options: {
                    content: ['./source/templates/**/*.html', './source/javascripts/**/*.js'],
                    extractors: {
                        extractor: class {
                            static extract(content) {
                                content.match(/a-Z/) || []
                            }
                        },
                        extension: ['html', 'blade']
                    },
                    whitelist: ['random', 'yep', 'button'],
                    whitelistPatterns: [/red$/]
                },
                files: {
                    '<%= paths.public %>/<%= paths.assets.styles %>/app.min.css': ['<%= paths.public %>/<%= paths.assets.styles %>/app.css']
                }
            }
        },

        gulp: {
            generateSW : function() {
                let workboxBuild = require('workbox-build');
                return workboxBuild.generateSW({
                    globDirectory: './public_html/resources/app/',
                    globPatterns: [
                        '**\/*.{html,json,js,css,png,jpg,svg,gif}',
                    ],
                    directoryIndex:'/resources/app/',
                    swDest: './public_html/sw.js'
                });
            }
        }
    });

    /////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////

    // Load npm tasks from the package.json
    require('load-grunt-tasks')(grunt, {scope: 'devDependencies'});

    /////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////

    grunt.registerTask('build', ['sass', /*'fontello',*/ 'copy', /*'imagemin',*/ 'bake', 'concat', /*'babel',*/ 'replace', 'autoprefixer', /*'modernizr',*/ 'favicons', 'uglify']);
    grunt.registerTask('default', ['build', 'watch']);

    //grunt.registerTask('build', ['clean', 'copy:fonts', 'copy:videos', 'sass:prod', 'concat:dist', 'uglify:prod', 'bake:dist', 'prettify:html', 'replace:assets', 'modernizr', 'unretina', 'imagemin:assets']);

    //grunt.registerTask('dev', ['clean', 'copy:fonts', 'copy:videos', 'sass:dev', 'concat:dist', 'uglify:dev', 'bake:dist', 'prettify:html', 'replace:assets', 'modernizr', 'unretina', 'imagemin:assets']);
    //grunt.registerTask('build', ['sass:dist', 'concat:dist', 'uglify:dist', 'bake:dist', 'replace:assets', 'modernizr']);


    grunt.registerTask('watchset', ['concurrent:compile', 'concurrent:replace', 'autoprefixer']);

    grunt.registerTask('serve:dev', ['dev', 'connect:server', 'browserSync', 'watch:compile']);
    grunt.registerTask('serve:prod', ['build', 'connect:server', 'browserSync', 'watch:compile']);
}