'use strict';

var tmp = require('temporary');
var path = require('path');
var phantomBinaryPath = require('phantomjs').path;
var runnerPath = path.join(__dirname, '..', 'phantomjs', 'runner.js');
var phantomCSSPath = path.join(__dirname, '..', 'node_modules', 'phantomcss');
var grunt = require('grunt');


module.exports = function (options, done) {
  // Create a temporary file for message passing between the task and PhantomJS
  var tempFile = new tmp.File();

  // Pass necessary paths
  options.tempFile = tempFile.path;
  options.phantomCSSPath = phantomCSSPath;

  // Timeout ID for message checking loop
  var messageCheckTimeout;

  // The number of tempfile lines already read
  var lastLine = 0;

  // The number of failed tests
  var failureCount = 0;

  // This is effectively the project root (location of Gruntfile)
  // This allows relative paths in tests, i.e. casper.start('someLocalFile.html')
  var cwd = process.cwd();

  var deleteFiles = function (files) {
    files.forEach(function (filepath) {
      grunt.file.delete(filepath);
    });
  };

  var deleteDiffScreenshots = function () {
    deleteFiles(grunt.file.expand([
      path.join(options.screenshots, '*diff.png'),
      path.join(options.screenshots, '*fail.png')
    ]));
  };

  var deleteDiffFailures = function () {
    deleteFiles(grunt.file.expand([
      options.failures
    ]));
  };

  var copyDiffAndOriginalToFailureFolder = function (file) {
    var filename = path.basename(file);
    filename = filename.replace(path.extname(filename), '');

    var files = grunt.file.expand([
      file,
      path.join(options.screenshots, filename + '*diff.png')
    ]);

    files.forEach(function (file) {
      grunt.file.copy(file, path.join(options.failures, path.basename(file)));
    });

  };


  var cleanup = function (error) {
    // Remove temporary file
    tempFile.unlink();

    deleteDiffScreenshots();

    done(error || failureCount === 0);
  };

  var getLines = function () {
    // Disable logging temporarily
    grunt.log.muted = true;

    // Read the file, splitting lines on \n, and removing a trailing line
    var lines = grunt.file.read(tempFile.path).split('\n').slice(0, -1);

    // Re-enable logging
    grunt.log.muted = false;

    return lines;
  };

  var checkForMessages = function checkForMessages(stopChecking) {
    var lines = getLines();

    // Iterate over all lines that haven't already been processed
    lines.slice(lastLine).some(function (line) {
      // Get args and method
      var args = JSON.parse(line);
      var eventName = args[0];

      // Debugging messages
      grunt.log.debug(JSON.stringify(['phantomjs'].concat(args)).magenta);

      // Call handler
      if (messageHandlers[eventName]) {
        messageHandlers[eventName].apply(null, args.slice(1));
      }
    });

    // Update lastLine so previously processed lines are ignored
    lastLine = lines.length;

    if (stopChecking) {
      clearTimeout(messageCheckTimeout);
    } else {
      // Check back in a little bit
      messageCheckTimeout = setTimeout(checkForMessages, 100);
    }
  };

  var messageHandlers = {
    onFail: function (test) {
      grunt.log.writeln('Visual change found for ' + path.basename(test.filename) + ' (' + test.mismatch + '% mismatch)');
      copyDiffAndOriginalToFailureFolder(test.filename);
    },

    onPass: function (test) {
      grunt.log.writeln('No changes found for ' + path.basename(test.filename));
    },

    onTimeout: function (test) {
      grunt.log.writeln('Timeout while processing ' + path.basename(test.filename));
    },

    onNewImage: function (test) {
      if (options.noNewScreenshot) {
        grunt.fail.fatal('Not allowed to create new screenshot (' + path.basename(test.filename) + ') when --no-new-screenshot is passed.');
      } else {
        grunt.log.writeln(test.filename);
      }
    },

    onComplete: function (allTests, noOfFails, noOfErrors) {
      if (allTests.length) {
        var noOfPasses = allTests.length - failureCount;
        failureCount = noOfFails + noOfErrors;

        if (failureCount === 0) {
          grunt.log.ok('All ' + noOfPasses + ' tests passed!');
        } else {
          if (noOfErrors === 0) {
            grunt.log.error(noOfFails + ' tests failed.');
          } else {
            grunt.log.error(noOfFails + ' tests failed, ' + noOfErrors + ' had errors.');
          }
        }
      }
    }
  };


  deleteDiffScreenshots();
  deleteDiffFailures();

  // Start watching for messages
  checkForMessages();

  grunt.util.spawn({
    cmd: phantomBinaryPath,
    args: [
      runnerPath,
      JSON.stringify(options),
    ],
    opts: {
      cwd: cwd,
      stdio: 'inherit'
    }
  }, function (error, result, code) {
    // When Phantom exits check for remaining messages one last time
    checkForMessages(true);

    cleanup(error);
  });
};
