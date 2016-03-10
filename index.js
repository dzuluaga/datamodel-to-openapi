'use strict'

var SwaggerModel = require('./lib/swagger-api'),
    jsonRefs = require('json-refs'),
    debug = require('debug')('model2swagger'),
    path = require('path');

module.exports = function( dataModelJson ) {
  return SwaggerModel( dataModelJson )
      .then( function( swaggerDoc ) {
        for ( var attrname in swaggerDoc.getPaths ) { swaggerDoc.getInfo[attrname] = swaggerDoc.getPaths[attrname]; }
        for ( var attrname in swaggerDoc.getInfo ) { swaggerDoc.getBase[attrname] = swaggerDoc.getInfo[attrname] }
        return jsonRefs.resolveRefs( swaggerDoc.getBase , {
              filter: ['relative', 'remote', 'local']
            })
            .then( function( swaggerDoc ) {
              return swaggerDoc.resolved;
            } )
      })
      .catch( function ( err ) {
        console.log( err.stack );
        throw err;
      });
}