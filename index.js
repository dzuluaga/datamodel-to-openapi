'use strict'

var dbModel = require('./test/model.json');
var SwaggerModel = require('./lib/swagger-api');
var jsonRefs = require('json-refs');

//var swaggerModel = new SwaggerModel( dbModel );//Object.create( SwaggerModel.prototype, { dbModel: { value: dbModel } } );
var swaggerModel = Object.create( SwaggerModel.prototype );
SwaggerModel.call( swaggerModel, dbModel );

var sm = SwaggerModel( dbModel);

//console.log( JSON.stringify( sm, null, 2) );

for (var attrname in sm.getPaths) { sm.getInfo[attrname] = sm.getPaths[attrname]; }

jsonRefs.resolveRefs( sm.getInfo , {
  filter: ['relative', 'remote', 'local'],
  relativeBase: './test/'
})
    .then( function( swaggerDoc ) {
      console.log( JSON.stringify( swaggerDoc.resolved, null, 2 ) );
    } );

//console.log( SwaggerModel( dbModel) );