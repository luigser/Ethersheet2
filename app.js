var config,
server = require('./lib/master');
const cluster = require('cluster');

if(process.env.CONFIG_PATH){
  config = require(process.env.CONFIG_PATH);
} else {
  config = require('./config');
}

process.env.NODE_ENV = 'production';

server.createMasterServer(config);




