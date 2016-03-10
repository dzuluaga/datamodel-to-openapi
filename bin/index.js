#!/usr/bin/env node

var datamodelToSwagger = require('../index'),
    debug = require('debug')('app.js'),
    fs = require('fs'),
    path = require('path');

var program = require('commander');

program
    .version('0.0.1')
    .command('generate [location]')
    .description('Generates swagger spec based on data model JSON document')
    .action( function( location ) {
      var that = this;
      datamodelToSwagger( require( path.join( process.cwd(), location ) ) )
          .then( function( swaggerDoc ) {
            console.log( JSON.stringify( swaggerDoc, null, 2 ) );
          })
          .catch( function( err ) {
            console.log( err.stack );
          });
    })
    .parse(process.argv);



// Default command (handles all unregistered commands)
program
    .command('*', null, {noHelp: true}) // null is required to avoid the implicit 'help' command being added
    .action(function (cmd) {
      handleUnknownCommand(cmd);
    });

function handleUnknownCommand (command) {
  // Using log instead of error since commander.js uses console.log for help output
  console.log(program._name + ' does not support the ' + command + ' command.');

  program.outputHelp();
};

// Process the CLI arguments and run
if (!process.argv.slice(2).length) {
  program.outputHelp();
} else {
  program.parse(process.argv);
}