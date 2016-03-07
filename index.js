'use strict'

var dbModelFile = './test/model.json';
var dbModel = require( dbModelFile ),
    SwaggerModel = require('./lib/swagger-api'),
    jsonRefs = require('json-refs'),
    fs = require('fs'), debug = require('debug')('model2swagger'),
    path = require('path');

dbModel.dir = path.parse( dbModelFile).dir;

/*var swaggerModel = Object.create( SwaggerModel.prototype );
SwaggerModel.call( swaggerModel, dbModel );*/

SwaggerModel( dbModel)
    .then( function( swaggerDoc ) {
      for (var attrname in swaggerDoc.getPaths) { swaggerDoc.getInfo[attrname] = swaggerDoc.getPaths[attrname]; }
      for (var attrname in swaggerDoc.getInfo) { swaggerDoc.getBase[attrname] = swaggerDoc.getInfo[attrname] }
      jsonRefs.resolveRefs( swaggerDoc.getBase , {
            filter: ['relative', 'remote', 'local'],
            relativeBase: './test/'
          })
          .then( function( swaggerDoc ) {
            fs.writeFile("./tmp/swagger.json", JSON.stringify( swaggerDoc.resolved, null, 2 ), function(err) {
              if(err) {
                return console.log(err);
              }
              console.log("The file was saved!");
            });
          } );
    })
    .catch( function ( err ) {
      return console.log( err.stack );
    });