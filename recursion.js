var tree = {
  "org" : {
    "model": "org",
    "sub" : ["api"]
  },
  "api" : {
    "model": "api",
    "sub" : ["apiversion"]
  },
  "apiversion": {
    "model": "apiversion",
    "sub": ["proxy", "resourcefile"]
  },
  "proxy": {
    "model": "proxy"
  },
  "resourcefile":{
    "model": "resourcefile"
  }
}

function followTree( elemName, tree, parent ) {
  //console.log( elemName );
  console.log( 'look ma" ', elemName, 'with parent ', parent ? parent.model : 'no parent' );
  var node = tree[ elemName ];
  node.chilren = [];
  node.parent;
  if( parent ){
    node.parent = parent.model;//.push( parent.model )
  }
  if( node.sub ){
    node.sub.forEach( function( subr ) {
      node.chilren.push( tree[ subr ] );
      followTree( subr, tree, tree[ elemName ] );
    });
  }
}

followTree( "org", tree, null );

console.log( JSON.stringify( tree, null, 2 ) )
var arr = [];
function getPath( elemName, tree ){
  //console.log( tree[ elemName ].parent )
  if( tree[ elemName ].parent ){
    arr.push( tree[ elemName].parent );
    getPath( tree[ elemName ].parent, tree )
  }
}

getPath('resourcefile', tree );
console.log( arr )