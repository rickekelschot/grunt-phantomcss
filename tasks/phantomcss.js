/*
 * grunt-phantomcss
 * https://github.com/micahgodbolt/grunt-phantomcss
 *
 * Copyright (c) 2013 Chris Gladd
 * Copyright (c) since 2014 Anselm Hannemann
 * Copyright (c) since 2015 Micah Godbolt
 *
 * Licensed under the MIT license.
 */

'use strict';

var path = require('path');
var _ = require('lodash');
var TestRunner = require('../utils/test-runner');

module.exports = function (grunt) {
  grunt.registerMultiTask('phantomcss', 'CSS Regression Testing', function () {
    var done = this.async();

    // Variable object to set default values for options
    var options = this.options({
      rootUrl: false,
      baseUrl: '.',
      screenshots: 'screenshots',
      results: 'results',
      failures: 'failures',
      viewportSize: [1280, 800],
      mismatchTolerance: 0.05,
      waitTimeout: 5000, // Set timeout to wait before throwing an exception
      logLevel: 'warning' // debug | info | warning | error
    });

    var currentTestIndex = 0;

    options.absoluteBaseUrl = path.resolve(options.baseUrl);
    options.screenshots = path.join(options.baseUrl, '/' + options.screenshots);
    options.results = path.join(options.baseUrl, '/' + options.results);
    options.failures = path.join(options.baseUrl, '/' + options.failures);



    // Resolve paths for tests
    options.test = [];
    options.originalTest = [];
    options.testFolder = [];

    this.filesSrc.forEach(function (filepath) {
      options.test.push(path.resolve(filepath));
      options.originalTest.push(filepath);
      options.testFolder.push(path.dirname(filepath));
    });

    var startTest = function () {
      var testOptions = _.clone(options);

      if (currentTestIndex < options.test.length) {
        var pathPostfix = options.testFolder[currentTestIndex]
          .replace(options.baseUrl, '')
          .replace('.', '');

        testOptions = _.extend(testOptions, {
          screenshots: path.join(testOptions.screenshots, pathPostfix),
          failures: path.join(testOptions.failures, pathPostfix),
          results: path.join(testOptions.results, pathPostfix),
          test: options.test[currentTestIndex],
          testFolder: options.testFolder[currentTestIndex],
          rebase: grunt.option('rebase'),
          noNewScreenshot: grunt.option('no-new-screenshot')
        });

        grunt.log.subhead('Running: ' + options.originalTest[currentTestIndex]);

        new TestRunner(testOptions, testComplete);
      } else {
        done();
      }
    };

    var testComplete = function (success) {
      if (success) {
        currentTestIndex += 1;
        startTest();
      } else {
        done(success);
      }
    };

    startTest();

  });
};
