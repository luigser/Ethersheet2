if (typeof define !== 'function') { var define = require('amdefine')(module) }
define( function(require){
	
// Ethersheet namespace and constants
return {
  DEFAULT_ROW_COUNT: 100,
  DEFAULT_COL_COUNT: 20,
  DEFAULT_CHUNK_SIZE: 50,
  SOCKET_URL: "http://localhost",
  DEFAULT_SELECTION_COLOR: '#dddddd',
  DEFAULT_LOCAL_SELECTION_COLOR: '#dddddd',
  DEFAULT_COLOR: '#ffffff'
};

});
