'use strict'

function swaggerSpec( dbModel ) {
  return {
    getInfo: getInfo( dbModel ),
    getPaths: getPaths ( dbModel )
  }
}

function getInfo( dbModel ) {
  return {
    swagger: "2.0",
    "x-db-models-var-name": dbModel[ "x-db-models-var-name" ],
    "produces": "application/json",
    "host": dbModel.host,
    title: dbModel.title,
    description: dbModel.description,
    contact: getContact( dbModel ),
    license: dbModel.license,
    version: dbModel.version
  }
};

function getContact( dbModel ) {
  return {
    name: dbModel.contact.name,
    url: dbModel.contact.url,
    email: dbModel.contact.email
  }
}

function getPaths( dbModel ) {
  var paths = {}
  dbModel.models.forEach( function( model ) {
    if( model.isPublic === undefined || model.isPublic == true ) { paths[ model.path ] = generatePathFromModel( model ) }
  } );
  return paths;
}

function generatePathFromModel( dbModel ) {
  var path = {};
  ( dbModel.verbs || [ 'get' ] ).forEach( function( verb ){
    path[ verb ] = generatePathVerb( verb, dbModel );
  } );
/*  if( dbModel.paths ) {
    Object.keys(dbModel.paths).forEach(function (pathKey) {
      path[pathKey] = {};
    });
  }*/
  return path;
}

function generatePathVerb( verb, dbModel ) {
  return {
    'x-swagger-router-controller': 'GenericRoute',
    'operationId': 'getResource',
    'x-model': {
      'model': dbModel.model,
      // TODO to be changed for subresources
      'cardinality': 'findAll',
      'tags': dbModel.path,
      'description': dbModel.description || {"TODO": "TODO"},
      'parameters': dbModel.parameters || {"TODO": "TODO"},
      'responses': dbModel.responses || {"TODO": "TODO"}
    }
  };
}


module.exports = swaggerSpec;