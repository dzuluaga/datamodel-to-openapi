var datamodelToSwagger = require('../index'),
    //dataModelJsonPath = require('./sample-data-model.json'),
    path = require('path'),
    dataModelJsonPath = './sample-data-model.json',
    fs = require('fs');

datamodelToSwagger.generateOasAt( dataModelJsonPath )
    .then( function( swaggerDoc ) {
      fs.writeFile("./swaggerSample.json", JSON.stringify( swaggerDoc, null, 2 ), function(err) {
        if(err) {
          return console.log(err);
        }
        console.log("The file was saved!");
      });
    })
    .catch( function( err ) {
      console.log( err.stack );
    });
