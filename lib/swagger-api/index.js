'use strict'

var urlJoin = require('url-join'),
    debug = require('debug')('dbmodel2swagger'),
    path = require('path');

var dbModels = {};

function swaggerSpec( dbModel ) {
  setModelsKV( dbModel );
  return {
    getBase: {
      swagger: "2.0",
      "x-db-models-var-name": dbModel["x-db-models-var-name"],
      "produces": ["application/json"],
      "host": dbModel.host,
      "basePath": dbModel.basePath
    },
    getInfo: getInfo( dbModel ),
    getPaths: getPaths ( dbModel )
  }
}

function setModelsKV( dbModel ) {
  dbModel.models2 = {};
  dbModel.models.forEach( function( model ) {
    dbModel.models2[ model.model ] = model;
  });
  dbModels = dbModel.models2;
}

function getInfo( dbModel ) {
  return {
    "info" : {
      title: dbModel.title,
      description: dbModel.description,
      contact: getContact(dbModel),
      license: dbModel.license,
      version: dbModel.version
    }
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
  var swaggersPaths = [];
  dbModel.models.forEach( function( model ) {
    if( model.isPublic === undefined || model.isPublic == true ) {
      var collectionPath = generatePathFromModel( model, 'collection' );
      swaggersPaths.push( collectionPath );

      // find the attribute(s) from listAttribute with resourceId equals to true. So, that identifies the parameters to generate path. e.g. /org/{org_name}
      var entityPath = generatePathFromModel( model, 'entity' );
      swaggersPaths.push( entityPath ); //generatePathFromModel( model, false).swaggerPath;// generatePathVerb( 'get', model, false );
      findDescendants( model.model, dbModel.models2).forEach( function( descendantModel ) {
        debug('generating descendants for ', descendantModel);
        swaggersPaths.push( generatePathFromModel( dbModel.models2[ descendantModel ], 'collection', model.model ) );
        swaggersPaths.push( generatePathFromModel( dbModel.models2[ descendantModel ], 'entity', model.model  ));
      });
    }
  } );
  var swaggerPathObjs = {};
  swaggersPaths.forEach( function( swaggerPath ) {
    debug('generate swaggerObj path from ', swaggerPath.path);
    swaggerPathObjs[ swaggerPath.path ] = swaggerPath.swagger[ swaggerPath.path ];
  });
  return { paths: swaggerPathObjs };
}

function generatePathFromModel( dbModel, pathType, relativeParentModel ) {
  var swagger = {};
  ( dbModel.verbs || [ 'get' ] ).forEach( function( verb ){
    swagger = generatePathVerb( verb, dbModel, pathType, relativeParentModel );
  } );
  return { path: swagger.path, swagger: swagger.swagger };
}

function generatePathVerb( verb, dbModel, pathType, relativeParentModel ) {
  var whereAttributes;
  var params;
  var description;
  var responses;
  debug('generatePathVerb for ', dbModel.model);
  params = dbModel.resources[pathType].parameters;
  description = dbModel.resources[pathType].description;
  responses = dbModel.resources[pathType].responses;
  var swagger = {};
  var lineAge = getLineage( dbModel.model, dbModels, relativeParentModel );
  debug('lineage for model', dbModel.model, ' is ', lineAge);
  var pathStr = getPathFromLineage( dbModel.model, lineAge, pathType );
  swagger[ pathStr ] = {};
  swagger[ pathStr ][ verb ] = {
    'x-swagger-router-controller': 'GenericRoute',
    'operationId': 'getResource',
    'x-model': {
      'model': dbModel.model,
      'cardinality': pathType === 'collection' ? 'findAll' : 'findOne',
      'whereAttributes': whereAttributes
    },
    'tags': [ dbModel.path ],
    'description': description || {"TODO": "TODO"},
    'parameters': params || dbModel.parameters || {"TODO": "TODO"},
    'responses': responses || {"TODO": "TODO"}
  };
  return { swagger: swagger, path: pathStr };
}

function getPathFromLineage( model, lineAge, pathType ) {
  var paths = [];
  debug('getPathFromLineage for model: ', model);
  lineAge.forEach( function( ancestorModel ) {
    var resourceIds = getResourceIdAttributes( dbModels[ ancestorModel] );
    if( pathType === 'collection' && model === ancestorModel ){
      paths.push( urlJoin( dbModels[ ancestorModel].path ) );
    } else {
      paths.push( urlJoin( dbModels[ ancestorModel].path, '{' + resourceIds[0].resource.alias + '}' ) );
    }
  });
  var lineAgePath = paths.join('');
  debug( 'after joining paths', lineAgePath );
  return lineAgePath;
}

function getLineage( modelName, dbModels, relativeParentModel ) {
  var parentModels = [ ];
  debug('getLineage for model ', modelName);
  function _getLineAge( modelName, relativeParentModel ) {
    var model = dbModels[ modelName ];
    ( model.associations || [] ).forEach( function( assoc ) {
      if( modelName && assoc.type === 'belongsTo' ) {
        parentModels.push( assoc.modelName );
        if ( assoc.modelName != relativeParentModel ) {
          _getLineAge(assoc.modelName, relativeParentModel);
        }
      }
    });
  }
  _getLineAge( modelName, relativeParentModel );
  var parentModels = parentModels.reverse();
  parentModels.push( dbModels[ modelName].model );
  return parentModels;
}

function findDescendants( modelName, dbModels ) {
  var descendantModels = [];
  function _findDescendants( modelName ) {
    ( dbModels[ modelName ].associations || [] ).forEach( function( assoc ) {
      if( assoc.type === 'hasMany' ) {
        descendantModels.push( assoc.modelName );
        _findDescendants( assoc.modelName );
      }
    });
  }
  _findDescendants( modelName, dbModels );
  return descendantModels;
}

function getResourceIdAttributes( dbModel ) {
  var resourceIds = [];
  Object.keys( dbModel.listAttributes ).forEach( function( key ) {
    if( dbModel.listAttributes[key].resource ) {
      resourceIds.push( { name: key, resource: dbModel.listAttributes[key].resource } );
    }
  } );
  return resourceIds;
}

module.exports = swaggerSpec;

/*function generateSubpathFromAssociation( assoc, dbModel, parent, parentSubpath, isCollection ) {
 var matchModel;
 dbModel.models.forEach( function( model ) {
 if( assoc.modelName === model.model ) {
 debug('generating subresource ', model.name, 'for parent resource', parent.model);
 matchModel = generatePathFromModel( model, isCollection, true, assoc, parentSubpath );
 }
 } );
 return { path: urlJoin( parentSubpath.path, matchModel.path ), swaggerPath: matchModel.swaggerPath.path };
 }*/

/*      model.associations.map( function( assoc ) {
 /!*        debug( 'check value of resourceFieldName', entityPath.resourceFieldName );
 var subpath = generateSubpathFromAssociation( assoc, dbModel, model, entityPath, true );
 paths[ subpath.path ] = subpath.swaggerPath;
 debug( 'found subpath', subpath );

 subpath = generateSubpathFromAssociation( assoc, dbModel, model, entityPath, false );
 paths[ subpath.path ] = subpath.swaggerPath;*!/
 generatePathFromModel( model, 'entity', [ model.model ] );

 /!*lineAge.forEach( function( parentModel ) {

 })*!/

 })*/

/*function generatePathVerb( verb, dbModel, isCollection, isSubresource, assoc, parentSubpath ) {
 var listAttributes;
 var whereAttributes;
 var params;
 var description;
 var responses;
 debug('generatePathVerb for model', dbModel.model);
 if( isCollection && !isSubresource ) {
 params = dbModel.resources.collection.parameters;
 description = dbModel.resources.collection.description;
 responses = dbModel.resources.collection.responses;
 } else if( !isCollection && !isSubresource) {
 listAttributes = getResourceIdAttributes( dbModel );
 whereAttributes = [];
 whereAttributes.push( { "attributeName": listAttributes[0], "paramName": listAttributes[0] } )
 //params.push( { "name": listAttributes[0], "in": "path", "description": dbModel.listAttributes[ listAttributes[0]].description, "type": dbModel.listAttributes[ listAttributes[0]].type, "required": true} );
 params = dbModel.resources.entity.parameters;
 description = dbModel.resources.entity.description;
 responses = dbModel.resources.entity.responses;
 } else if( isCollection && isSubresource ) {
 debug( 'adding subresource ', dbModel.name, ' to parent ', parentSubpath );
 params = assoc.resources.collection.parameters;
 description = dbModel.resources.collection.description;
 responses = dbModel.resources.collection.responses;
 whereAttributes = [];
 whereAttributes.push( { "attributeName": assoc.foreignKey, "paramName": parentSubpath.resourceFieldName } )
 }*/

/*
 if( pathType === 'entity' ) {
 var resourceIds = getResourceIdAttributes( dbModel );
 pathStr = urlJoin ( pathStr, '{' + resourceIds[0].resource.alias + '}' );
 whereAttributes = [];
 whereAttributes.push({"attributeName": resourceIds[0].name, "paramName": resourceIds[0].resource.alias})
 }
 */