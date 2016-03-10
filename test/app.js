var datamodelToSwagger = require('../index'),
    dataModelJson = require('./sample-data-model.json');
datamodelToSwagger( dataModelJson )
    .then( function( swaggerDoc ) {
      console.log( JSON.stringify( swaggerDoc, null, 2 ) );
    })
    .catch( function( err ) {
      console.log( err.stack );
    });
