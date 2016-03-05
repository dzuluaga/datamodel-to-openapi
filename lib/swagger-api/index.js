'use strict'

var urlJoin = require('url-join'),
    debug = require('debug')('dbmodel2swagger'),
    path = require('path'),
    jsonRefs = require('json-refs'),
    sync = require('synchronize');

var dbModels = {};
var modelDir;

function swaggerSpec( dbModel ) {
  setModelsKV( dbModel );
  modelDir = dbModel.dir;
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
      findDescendants( model.model, dbModel.models2, true ).forEach( function( descendantModel ) {
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
    //swagger = generatePathVerb( verb, dbModel, pathType, relativeParentModel );
    generatePathVerb( verb, dbModel, pathType, relativeParentModel )
        .then( function( path ) {

        })
  } );
  return { path: swagger.path, swagger: swagger.swagger };
}

function generatePathVerb( verb, dbModel, pathType, relativeParentModel ) {
  //var paramsPromise = getModelParams( dbModel.model, pathType );
  return getModelParams( dbModel.model, pathType )
      .then( function( params ) {
        debug('generatePathVerb for ', dbModel.model);
        //var params;
        var description;
        var responses;
        var _pathType =  ( pathType === 'collection' ) ? 'collection' : 'entity';
        debug('params from promise', params);
        //params = dbModel.resources[_pathType].parameters;
        description = dbModel.resources[_pathType].description;
        responses = dbModel.resources[_pathType].responses;
        var swagger = {};
        var pathStr = dbModel.path;
        debug('lineage path:', pathStr );
        var whereAttributes = getWhereFromLineage( dbModel, relativeParentModel, pathType );
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
          'parameters': params || {"TODO": "TODO"},
          'responses': responses || {"TODO": "TODO"}
        };
        return { swagger: swagger, path: pathStr };
      })
      .catch( function( err ) {
        return console.log( err );
      })
}

function getModelParams( modelName, pathType ) {
  var modelParamsRef = dbModels[ modelName].resources[ pathType].parameters;
  modelParamsRef = new Object( modelParamsRef )
  debug( 'getModelParams', modelParamsRef );
  var p = jsonRefs.resolveRefs( modelParamsRef, { relativeBase: modelDir } );
/*      .then( function( res ) {
        return res.resolved;
      }, function ( error ) {
        console.log( error.stack )
      } );*/
  debug( 'getModelParams', p );
  return p;
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
    var resourceIds = getResourceIdAttributes( dbModels[ ancestorModel], _isPrimaryKey, _isForeignKey, _isSecondaryKey );
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

function getWhereFromLineage( dbModel, relativeParentModel, pathType ) {
  var whereAttributes = [];
  var lineAge = getLineage( dbModel.model, dbModels, relativeParentModel );
  var resourceIds = [];
  debug( "getWhereFromLineage model", dbModel.model, 'linage:', lineAge );

  // single resource e.g. /orgs/{org_name}, /apis/{api_name}
  if( lineAge.length == 1 && pathType === 'entity' ) {
    resourceIds = resourceIds.concat( getResourceIdAttributes( dbModel, true, false, false ) );
  } else if( lineAge.length > 1 ) {
    var resourceForeignIds = resourceIds.concat( getResourceIdAttributes( dbModel, false, true, true ) );
    lineAge.forEach( function ( modelName ) {
      debug( 'finding foreign keys for model:', modelName, 'with lineAge:', lineAge );
      debug( 'getWhereFromLineage only for collection', modelName, dbModel.model, pathType );
      resourceIds = resourceIds.concat( findForeignKeyResourceId( modelName, resourceForeignIds ) );
      debug('found modelName', modelName, resourceForeignIds, resourceIds);
    });

    // find resource Ids (non-foreign keys) for entities only. e.g. /orgs/{org_id}/apis/{api_id}. In this case api_id.
    if( pathType == 'entity' ) {
      resourceIds = resourceIds.concat(getResourceIdAttributes(dbModel, false, false, true));
    }
  }
  resourceIds.forEach( function( resourceId ) {
    debug('getting resourceId where for', dbModel.model, resourceId);
    whereAttributes.push({"attributeName": resourceId.name, "paramName": resourceId.resource.alias});
  } );
  return whereAttributes;
}

function findForeignKeyResourceId( modelName, resourceIds ) {
  var foreignKey = resourceIds.filter( function( resourceId ) {
    debug( 'findForeignKeyResourceId', 'resourceId.model:', resourceId.model, 'modelName:', modelName );
    if( resourceId.model === modelName ){
      return true;
    }
  });
  return foreignKey;
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

/*
 * @onlyForRootModel: boolean. Root models are models that have no ancestors. e.g. Org.
 */

function findDescendants( modelName, dbModels, onlyForRootModel ) {
  var descendantModels = [ modelName ];
  debug( 'getting lineAge from root for', modelName );
  function _findDescendants( modelName ) {
    ( dbModels[ modelName ].associations || [] ).forEach( function( assoc ) {
      if( assoc.type === 'hasMany' ) {
        descendantModels.push( assoc.modelName );
        _findDescendants( assoc.modelName );
      }
    });
  }
  if( onlyForRootModel ){
   debug( 'onlyForRootModel', onlyForRootModel );
   var lineAge = getLineage( modelName, dbModels, undefined );

   //only retrieve descendants for models that have no lineage (parents), in our case org has lineAge to itself
   if( lineAge.length == 1 ){
   _findDescendants( modelName, dbModels );
   }
   } else {
   _findDescendants( modelName, dbModels );
   }
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
      var _resourceId = dbModel.listAttributes[key];
      _resourceId.name = key;
      resourceIds.push( _resourceId );
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
