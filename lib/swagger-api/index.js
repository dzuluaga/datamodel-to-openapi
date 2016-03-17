'use strict'

var urlJoin = require('url-join'),
    debug = require('debug')('dbmodel2swagger'),
    path = require('path'),
    jsonRefs = require('json-refs');

var dbModels = {};
var modelDir;

function swaggerSpec( dbModel ) {
  setModelsKV( dbModel );
  modelDir = dbModel.dir;
  var swaggerDoc = getPaths( dbModel )
      .then( function( paths ) {
        debug('these are paths', paths);
        return {
          getBase: {
            swagger: "2.0",
            "x-db-models-var-name": dbModel["x-db-models-var-name"],
            "produces": ["application/json"],
            "host": dbModel.host,
            "basePath": dbModel.basePath
          },
          getInfo: getInfo( dbModel ),
          getPaths: paths
        }
      })
      .catch( function( err ){
        console.log( err.stack );
        debug( 'Error in swaggerSpec' );
        throw err;
        //return console.log( err.stack );
      });
  debug('here is the swaggerDoc', swaggerDoc);
  return swaggerDoc;
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
  return Promise.all( swaggersPaths )
      .then( function( swaggerPathsResolved ) {
        var swaggerPathObjs = {};
        swaggerPathsResolved.forEach( function( swaggerPath, index ) {
          debug('swaggerPath.path', swaggerPath.path );
          swaggerPathObjs[ swaggerPath.path ] = swaggerPath.swagger[ swaggerPath.path ];
        });
        return { paths: swaggerPathObjs };
      })
      .catch( function( err ) {
        debug('error in getPaths');
        console.log( err.stack );
        throw err;
        //return console.log( err.stack );
      });
}

function generatePathFromModel( dbModel, pathType, relativeParentModel ) {
  var pathVerbPromises = [];
  ( dbModel.verbs || [ 'get' ] ).forEach( function( verb ){
    pathVerbPromises.push( generatePathVerb( verb, dbModel, pathType, relativeParentModel ) );

  } );
  return Promise.all( pathVerbPromises )
      .then( function( pathVerbs ) {
        var swagger = {};
        pathVerbs.forEach( function( pathVerb ) {
          swagger = { path: pathVerb.path, swagger: pathVerb.swagger } ;
        });
        return swagger;
      })
      .catch( function( err ) {
        debug( 'error in generatePathFromModel' );
        console.log( err.stack );
        throw err;
      })
}

function generatePathVerb( verb, dbModel, pathType, relativeParentModel ) {
  debug( 'getting lineage on generatePathVerb', getLineage( dbModel.model, dbModels, relativeParentModel ) );
  return getModelParams( dbModel.model, relativeParentModel, pathType )
      .then( function( jsonRefsparams ) {
        debug('json-refs params before resolved', jsonRefsparams);
        return getAlwaysArrayType( jsonRefsparams );
      })
      .then( function( jsonRefsparams ) {
        var pathParams = buildPathParams( getParamsFromLineage( dbModel, relativeParentModel, pathType ) );
        pathParams = pathParams.concat( jsonRefsparams );
        debug('generatePathVerb for ', dbModel.model);
        var _pathType =  ( pathType === 'collection' ) ? 'collection' : 'entity';
        var description = dbModel.resources[_pathType].description;
        var responses = dbModel.resources[_pathType].responses;
        var swagger = {};
        var pathStr = dbModel.path;
        debug('lineage path:', pathStr );
        var whereAttributes = getWhereFromLineage( dbModel, relativeParentModel, pathType );
        var pathStr = getPathFromLineage( dbModel.model, relativeParentModel, _pathType );
        swagger[ pathStr ] = {};
        swagger[ pathStr ][ verb ] = {
          'x-swagger-router-controller': 'GenericRoute',
          'operationId': 'getResource',
          'x-data-model': {
            'model': dbModel.model,
            'cardinality': _pathType === 'collection' ? 'findAll' : 'findOne',
            'whereAttributes': whereAttributes
          },
          'tags': [ dbModels[ relativeParentModel ].path ],
          'description': description || {"TODO": "TODO"},
          'parameters': pathParams || {"TODO": "TODO"},
          'responses': responses || {"TODO": "TODO"}
        };
        return { swagger: swagger, path: pathStr };
      })
      .catch( function( err ) {
        console.log( err.stack );
        throw err;
        //return console.log( err.stack );
      })
}

/*
 * function required to fix issue with json-refs promise returning objects or array object types
 */
function getAlwaysArrayType( object ) {
  var _params = object;
  debug('_params is array?', _params, Array.isArray(_params) );

  //if object is not array, then return an empty array
  if( !Array.isArray(_params) ) {
    _params = [];
  }
  return _params;
}

function getParamsFromLineage( dbModel, relativeParentModel, pathType ) {
  var params = [];
  var lineAge = getLineage( dbModel.model, dbModels, relativeParentModel );
  var resourceIds = [];
  debug( "getParamsFromLineage model", dbModel.model, 'linage:', lineAge );

  // single resource e.g. /orgs/{org_name}, /apis/{api_name}
  if( lineAge.length == 1 && pathType === 'entity' ) {
    resourceIds = resourceIds.concat( getAttributeForModelName( dbModel.model, dbModel.model, lineAge ) );

  } else if( lineAge.length > 1 ) {
    lineAge.forEach( function ( modelName, index ) {
      debug( 'finding foreign keys for model:', modelName, 'with lineAge:', lineAge );
      debug( 'getWhereFromLineage only for collection', modelName, dbModel.model, pathType );

      // for paths like /orgs/{org_id}/apis, do not add parameter
      if( pathType == 'collection' && index == ( lineAge.length - 1 ) ){
        // do nothing
      } else{
        resourceIds = resourceIds.concat( getAttributeForModelName( dbModel.model, modelName, lineAge ) );
      }
    });
  }
  resourceIds.forEach( function( resourceId ) {
    debug('getting resourceId params for', dbModel.model, resourceId);
    params.push( resourceId );
  } );
  debug('params for model', dbModel.model, 'relative to mode', relativeParentModel, 'pathType:', pathType,' found:', params);
  return params;
}

function buildPathParams(attributeList ) {
  var paramList = [];
  attributeList.forEach( function( attribute ) {
    debug('inspecting parameter attribute', attribute);
    paramList.push( {
      "in": attribute.in || 'path',
      "name": attribute.alias || attribute.name,
      "required": attribute.required !== false,
      "description": attribute.description || "TODO",
      "type": attribute.type || "string"
    } );
  });
  debug( 'parameters generated', paramList );
  return paramList;
}

function getModelParams( modelName, relativeParentModel, pathType ) {
  var modelParamsRef = dbModels[ modelName].resources[ pathType ].parameters;
  console.log( modelParamsRef );
  var p = new Promise(
      function(resolve, reject) {
        resolve( modelParamsRef );
      });
  return p;
  /*  //modelParamsRef = new Object( modelParamsRef );
   modelParamsRef = {"$refs": ""};

   debug( 'getModelParams value from data model', modelParamsRef );
   var p = jsonRefs.resolveRefs( modelParamsRef, { relativeBase: modelDir } );
   debug( 'getModelParams', p );
   p.then( function( modelParamsList ) {
   debug( 'checking resolved', modelParamsList.resolved );
   return modelParamsList.resolved;
   } ).catch( function( err ) {
   console.log( err.stack );
   throw err;
   //return  console.log( err.stack );
   } );*/
}

function getPathFromLineage( model, relativeParentModel, pathType ) {
  var paths = [];
  var lineAge = getLineage( model, dbModels, relativeParentModel );
  debug('getPathFromLineage for model: ', model, relativeParentModel, 'lineAge:', lineAge);
  lineAge.forEach( function( ancestorModel, index ) {
    var attribute = getAttributeForModelName( model, ancestorModel, lineAge );
    debug( 'for model name', model, 'with ancestor', ancestorModel, 'attribute found', attribute );
    if( pathType === 'collection' && model === ancestorModel ){
      paths.push( urlJoin( dbModels[ ancestorModel].path ) );
    } else {
      debug( 'last element from the collection', attribute, 'path type', pathType );
      if( attribute === undefined ) debug( 'generating error for', model, relativeParentModel, pathType, attribute );
      paths.push( urlJoin( dbModels[ ancestorModel].path, '{' + ( attribute.alias || attribute.name ) + '}' ) );
    }
  });
  var lineAgePath = paths.join('');
  debug( 'after joining paths', lineAgePath );
  return lineAgePath;
}

function getAttributeForModelName(modelName, referenceModelName, lineAge ) {
  var attributeKeyRefModel;
  if( modelName === referenceModelName ) {

    // when dealing with root paths e.g. /orgs/{org_id}, /apis/{api_id}, etc.
    if( lineAge.length == 1 ){
      attributeKeyRefModel = Object.keys( dbModels[ modelName ].listAttributes ).filter( function( attributeKey ) {
        if( dbModels[ modelName ].listAttributes[ attributeKey].is_primary_key ) {
          return true
        }
      } );
    } else {
      attributeKeyRefModel = Object.keys( dbModels[ modelName ].listAttributes ).filter( function( attributeKey ) {

        // find attribute that is secondary and local (not foreign key)
        if( dbModels[ modelName ].listAttributes[ attributeKey].is_secondary_key && !dbModels[ modelName ].listAttributes[ attributeKey].model ) {
          return true
        }
      } );
    }
  } else {
    attributeKeyRefModel = Object.keys( dbModels[ modelName ].listAttributes ).filter( function( attributeKey ) {
      if( dbModels[ modelName ].listAttributes[ attributeKey].model === referenceModelName) {
        return true
      }
    } );
  }

  debug('found attributeKeyRefModel', attributeKeyRefModel)
  if( attributeKeyRefModel.length > 0 ) {
    dbModels[ modelName].listAttributes[ attributeKeyRefModel[0]].name = attributeKeyRefModel[0];
    return dbModels[ modelName].listAttributes[ attributeKeyRefModel[0] ];
  }
  else throw new Error('Exception modelName ' + modelName + ' is missing reference to model name ' + referenceModelName + ' with lineAge ' + lineAge );
}

function getWhereFromLineage( dbModel, relativeParentModel, pathType ) {
  var paramsArray = getParamsFromLineage( dbModel, relativeParentModel, pathType );
  debug('getting params for model', dbModel.model, 'and relative parent model', relativeParentModel, 'path type', pathType, paramsArray);
  var whereAttributes = [];
  paramsArray.forEach( function( resourceId ) {
    debug('getting resourceId where for', dbModel.model, resourceId);
    whereAttributes.push({"attributeName": resourceId.name, "paramName": ( resourceId.alias || resourceId.name ) });
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

function b( val ) {
  if( val == undefined || val == false || val == null) {
    return false;
  } else {
    return true;
  }
}

module.exports = swaggerSpec;