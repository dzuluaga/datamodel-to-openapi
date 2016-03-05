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

var sm = SwaggerModel( dbModel);

for (var attrname in sm.getPaths) { sm.getInfo[attrname] = sm.getPaths[attrname]; }
for (var attrname in sm.getInfo) { sm.getBase[attrname] = sm.getInfo[attrname] }


jsonRefs.resolveRefs( sm.getBase , {
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