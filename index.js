'use strict'

var dbModel = require('./test/model.json');
var SwaggerModel = require('./lib/swagger-api');
var jsonRefs = require('json-refs');
var fs = require('fs'), debug = require('debug')('model2swagger');

//var swaggerModel = new SwaggerModel( dbModel );//Object.create( SwaggerModel.prototype, { dbModel: { value: dbModel } } );
var swaggerModel = Object.create( SwaggerModel.prototype );
SwaggerModel.call( swaggerModel, dbModel );

var sm = SwaggerModel( dbModel);

for (var attrname in sm.getPaths) { sm.getInfo[attrname] = sm.getPaths[attrname]; }
for (var attrname in sm.getInfo) { sm.getBase[attrname] = sm.getInfo[attrname] }


jsonRefs.resolveRefs( sm.getBase , {
  filter: [/*'relative', 'remote', 'local'*/],
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

//console.log( JSON.stringify( sm, null, 2) );

//console.log( SwaggerModel( dbModel) );
//console.log( JSON.stringify( swaggerDoc.resolved, null, 2 ) );
