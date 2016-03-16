var datamodelToOas = require('../index');

datamodelToOas.generateOas( require('./sample-data-model.json') )
    .then( function( swaggerDoc ) {
      console.log( JSON.stringify( swaggerDoc, null, 2 ) );
    })
    .catch( function( err ) {
      console.log( err.stack );
    });