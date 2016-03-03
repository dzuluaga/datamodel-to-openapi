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
      findDescendants( model.model, dbModel.models2).forEach( function( descendantModel ) {
        debug('generating descendants for ', descendantModel);
        swaggersPaths.push( generatePathFromModel( dbModel.models2[ descendantModel ], 'collection', model.model ) );
        swaggersPaths.push( generatePathFromModel( dbModel.models2[ descendantModel ], 'entity', model.model ));
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
  var _pathType =  ( pathType === 'collection' ) ? 'collection' : 'entity';
  debug('generatePathVerb for ', dbModel.model);
  params = dbModel.resources[_pathType].parameters;
  description = dbModel.resources[_pathType].description;
  responses = dbModel.resources[_pathType].responses;
  var swagger = {};
  var pathStr = dbModel.path;
  debug('lineage path:', pathStr );
  if( _pathType === 'entity' ) {
    var resourceIds = getResourceIdAttributes( dbModel, false, false, true);
    whereAttributes = [];
    whereAttributes.push({"attributeName": resourceIds[0].name, "paramName": resourceIds[0].resource.alias})
  }
  var pathStr = getPathFromLineage( dbModel.model, relativeParentModel, _pathType );
  swagger[ pathStr ] = {};
  swagger[ pathStr ][ verb ] = {
    'x-swagger-router-controller': 'GenericRoute',
    'operationId': 'getResource',
    'x-model': {
      'model': dbModel.model,
      'cardinality': _pathType === 'collection' ? 'findAll' : 'findOne',
      'whereAttributes': whereAttributes
    },
    'tags': [ dbModel.path ],
    'description': description || {"TODO": "TODO"},
    'parameters': params || dbModel.parameters || {"TODO": "TODO"},
    'responses': responses || {"TODO": "TODO"}
  };
  return { swagger: swagger, path: pathStr };
}

function getPathFromLineage( model, relativeParentModel, pathType ) {
  var paths = [];
  var lineAge = getLineage( model, dbModels, relativeParentModel );
  debug('getPathFromLineage for model: ', model, relativeParentModel, 'lineAge:', lineAge);
  lineAge.forEach( function( ancestorModel, index ) {

    // always get the primary key for the first element of the path, except when the model is the same as the relativeParentModel e.g. single path resource e.g. /orgs/{org_id}
    var _isPrimaryKey = false, _isForeignKey = false, _isSecondaryKey = true;
    if( index == 0 && model == relativeParentModel ) {
      debug('switching to PK');
      _isPrimaryKey = true;
      _isForeignKey = false;
      _isSecondaryKey = false;
    }
    debug( 'index', index, '_isPrimaryKey', _isPrimaryKey, '_isForeignKey', _isForeignKey, '_isSecondaryKey', _isSecondaryKey )
    debug( 'path for ancestor:', ancestorModel);
    var resourceIds = getResourceIdAttributes( dbModels[ ancestorModel], _isPrimaryKey, _isForeignKey, _isSecondaryKey );//false, false, true);//true, false, false );
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
  var found = false;
  var index = 0;
  debug('getLineage for model ', modelName);
  function _getLineAge( modelName, relativeParentModel ) {
    var model = dbModels[ modelName ];
    ( model.associations || [] ).forEach( function( assoc ) {
      if( assoc.type === 'belongsTo' ) {

        // as soon as it finds relative parent model, stop. That means that when generating lineage for apis, starting from /apis, it will never return /orgs/apis, only /apis
        if( modelName != relativeParentModel ){
          parentModels.push(assoc.modelName);
        } else {
          found = true;
        }

        // only keep searching when relative parent model, has not reached. If so, stop searching.
        if ( !found ) {
          _getLineAge(assoc.modelName, relativeParentModel);
        }
      }
    });
  }
  _getLineAge(modelName, relativeParentModel);
  var parentModels = parentModels.reverse();
  parentModels.push( dbModels[ modelName].model );
  return parentModels;
}

function findDescendants( modelName, dbModels ) {
  var descendantModels = [ modelName ];
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

function getResourceIdAttributes( dbModel, isPrimaryKey, isForeignKey, isSecondaryKey ) {
  var resourceIds = [];
  Object.keys( dbModel.listAttributes ).forEach( function( key ) {
    debug( 'getResourceIdAttributes:', dbModel.model, key, b( dbModel.listAttributes[key].is_primary_key ), b( dbModel.listAttributes[key].is_foreign_key ), b( dbModel.listAttributes[key].is_secondary_key ) );
    if( dbModel.listAttributes[key].resource && isPrimaryKey === b( dbModel.listAttributes[key].is_primary_key )
        && isSecondaryKey === b( dbModel.listAttributes[key].is_secondary_key )
        && isForeignKey === b( dbModel.listAttributes[key].is_foreign_key ) ) {
      debug( 'getResourceIdAttributes:', dbModel.model , 'found resource', key, dbModel.listAttributes[key].is_primary_key, dbModel.listAttributes[key].is_foreign_key, dbModel.listAttributes[key].is_secondary_key );
      resourceIds.push( { name: key, resource: dbModel.listAttributes[key].resource } );
    }
  } );
  debug( 'getResourceIdAttributes: ', resourceIds );
  return resourceIds;
}

function b( val ) {
  if( val == undefined || val == false || val == null) {
    return false;
  } else {
    return true;
  }
}

module.exports = swaggerSpec;

//swaggersPaths.push( generatePathFromModel( model, 'collection', undefined, true, false, false, true ) );

// find the attribute(s) from listAttribute with resourceId equals to true. So, that identifies the parameters to generate path. e.g. /org/{org_name}
//swaggersPaths.push( generatePathFromModel( model, 'entity', undefined, true, false, false, true ) );

// push relative paths
//swaggersPaths.push( generatePathFromModel( model, 'collection', undefined, false, true, false, false ) );
//swaggersPaths.push( generatePathFromModel( model, 'entity', undefined, false, true, false, false ) );

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
