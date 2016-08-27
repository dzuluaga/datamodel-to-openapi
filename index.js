'use strict'

var SwaggerModel = require('./lib/swagger-api'),
    //jsonRefs = require('json-refs'),
    $RefParser = require('json-schema-ref-parser'),
    debug = require('debug')('model2oas'),
    path = require('path'),
    merge = require('merge'),
    pathParse = require('path-parse');

module.exports = {
  generateOasAt: generateOasAt,
  generateOas: generateOas
}

function generateOasAt(dataModelJsonPath){
  var fullPath = path.join( process.cwd(), dataModelJsonPath);
  return getSpec(require(fullPath));
}

function generateOas(dataModelJson) {
  // required to support object as a parameter
  if(typeof dataModelJson != 'object') {
    throw new Error('Invalid datamodel type. Object type expected.');
  }
  return getSpec(dataModelJson);
}

function getSpec(dataModelJson) {
  return $RefParser.dereference('./api/models/', dataModelJson, {})
      .then(function(dmResolved) {
        debug('data model resolved', dmResolved);
        return dmResolved;
      })
      .then( function(dataModelResolved) {
        return SwaggerModel(dataModelResolved)
            .then( function(swaggerDoc) {
              return merge(swaggerDoc.getBase, swaggerDoc.getInfo, swaggerDoc.getPaths);
            })
            .catch( function (err) {
              console.log(err.stack);
              throw err;
            });
      })
      .catch( function(err) {
        console.log(err.stack);
        throw err; //console.log( err.stack );
      })
}

/*'use strict'

var SwaggerModel = require('./lib/swagger-api'),
    jsonRefs = require('json-refs'),
    debug = require('debug')('model2oas'),
    path = require('path'),
    merge = require('merge'),
    pathParse = require('path-parse');

module.exports = {
  generateOasAt: generateOasAt,
  generateOas: generateOas
}

function generateOasAt(dataModelJsonPath ){
  var fullPath = path.join( process.cwd(), dataModelJsonPath );
  return getSpec( require( fullPath ), pathParse( fullPath ).dir );
}

function generateOas(dataModelJson ) {
  // required to support object as a parameter
  if( typeof dataModelJson != 'object') {
    throw new Error('Invalid datamodel type. Object type expected.');
  }
  return getSpec( dataModelJson, '.' );
}

function getSpec( dataModelJson, path ) {
  return jsonRefs.resolveRefs( dataModelJson, {
        filter: ['relative', 'remote', 'local'],
        relativeBase: path
      } )
      .then( function( dmResolved ) {
        debug('data model resolved', dmResolved);
        return dmResolved.resolved;
      })
      .then( function( dataModelResolved ) {
        return SwaggerModel( dataModelResolved )
            .then( function( swaggerDoc ) {
              return merge( swaggerDoc.getBase, swaggerDoc.getInfo, swaggerDoc.getPaths );
            })
            .catch( function ( err ) {
              console.log( err.stack );
              throw err;
            });
      })
      .catch( function( err ) {
        console.log( err.stack );
        throw err; //console.log( err.stack );
      })
}*/