'use strict';


function fastbootExpressMiddleware(distPath, options) {
  let opts = options;

  if (arguments.length === 1) {
    if (typeof distPath === 'string') {
      opts = { distPath: distPath };
    } else {
      opts = distPath;
    }
  }

  opts = opts || {};

  let log = opts.log !== false ? _log : function() {};

  let fastboot = opts.fastboot;

  if (!fastboot) {
    let FastBoot = require('fastboot');
    fastboot = new FastBoot({
      distPath: opts.distPath,
      resilient: opts.resilient
    });
  }

  return function(req, res, next) {
    let path = req.url;
    fastboot.visit(path, { request: req, response: res })
      .then(success, failure);

    function success(result) {
      result.html()
        .then(html => {
          let headers = result.headers;
          let statusMessage = result.error ? 'NOT OK ' : 'OK ';

          let cookies = {};
          for (var pair of headers.entries()) {
            if (pair[0].match(/^set-cookie$/i)) {
              let cookieName = pair[1].match(/.+?(?=\=)/)[0];
              cookies[cookieName] = pair[1];
            } else {
              res.set(pair[0], pair[1]);
            }
          }

          res.set('Set-Cookie', Object.keys(cookies).map((k) => cookies[k]));

          if (result.error) {
            log("RESILIENT MODE CAUGHT:", result.error.stack);
            next(result.error);
          }

          log(result.statusCode, statusMessage + path);
          res.status(result.statusCode);
          res.send(html);
        })
        .catch(error => {
          res.status(500);
          next(error);
        });
    }

    function failure(error) {
      if (error.name === "UnrecognizedURLError") {
        next();
      } else {
        res.status(500);
        next(error);
      }
    }
  };
}

let chalk;

function _log(statusCode, message, startTime) {
  chalk = chalk || require('chalk');
  let color = statusCode === 200 ? 'green' : 'red';
  let now = new Date();

  if (startTime) {
    let diff = Date.now() - startTime;
    message = message + chalk.blue(" " + diff + "ms");
  }

  console.log(chalk.blue(now.toISOString()) + " " + chalk[color](statusCode) + " " + message);
}

module.exports = fastbootExpressMiddleware;
