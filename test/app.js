var datamodelToSwagger = require('../index');

datamodelToSwagger.generateSwagger( require('./sample-data-model.json') )
    .then( function( swaggerDoc ) {
      console.log( JSON.stringify( swaggerDoc, null, 2 ) );
    })
    .catch( function( err ) {
      console.log( err.stack );
    });