const http           = require('http');
const cluster        = require('cluster');
const httpProxy      = require('http-proxy');
const _              = require('underscore');
const URL            = require('url');
const server         = require('./s');
const config         = require('../config');

exports.createMasterServer = function(config){

    let slaveServers = [];
    let proxy = httpProxy.createProxyServer();

    function getResourceKeyFromURL(url){
        url = url.replace(/\/ethersheet/, "");
        url = url.replace(/\/export_to_csv/, "");
        url = url.replace(/\/s\//, "");
        url = url.replace(/\/mediaroom\/init/, "");
        url = url.replace(/\/mediaroom\/addrow/, "");
        url = url.replace(/\/addrow/, "");
        url = url.replace(/\/images\/?.*/, "");
        url = url.replace(/\/upload\/?.*/, "");
        url = url.replace(/\/pubsub\/?.*/, "");
        url = url.replace(/\/es_client\/?.*/, "");
        if( url.indexOf("/") >= 0 ) url =  url.slice(1, url.length);
        return url;
    }

    function getKeyByWorkerPid(pid){
        let key = undefined;
        let keys = Object.keys(slaveServers);
        for(var k in keys){
            if(slaveServers[keys[k]].worker.process.pid === pid){
                key = keys[k];
                break;
            }
        }
        return key;
    }

    function assignSlave(request, response)
    {
        let referer = request.headers.referer;
        let temp_key, key;

        temp_key = request.url;
        if(request.url.indexOf("import") >= 0 || (request.url.indexOf("export_to_csv") >= 0 && !_.isUndefined(referer))) {
            //When the url contains the sheetName (the sheet key) as parameter in the url,
            //it extract this key, choosing in this way the process that has the sheetName.
            if (temp_key.indexOf("/import/csv?sheetName=") >= 0) {
                temp_key = temp_key.replace("/import/csv?sheetName=", "");
            } else {
                temp_key = URL.parse(referer).pathname;
            }
        }

        key = getResourceKeyFromURL( temp_key.trim());

        if(_.isEmpty(key)){
            //static resources
            let servers_keys = Object.keys(slaveServers);
            key = servers_keys[Math.floor(Math.random() * servers_keys.length)];
        }

        if ( _.isUndefined(slaveServers[key]) ) {
            console.log("URL: " + request.url);
            console.log("REFERER: " + referer);
            console.log("KEY: " + key);
            slaveServers[key] = {worker : cluster.fork(), request : request, response: response, online: false};
            //Proxy first request ofter eorker is online
            slaveServers[key].worker.on('message', function( data ){
                var key = getKeyByWorkerPid(data.pid);
                slaveServers[key].online = true;
                proxy.web(slaveServers[key].request, slaveServers[key].response, {target : "http://localhost:" + (config.port + (data.pid % 1000))}, function(e){console.log(e)});
            });
            //Kill worker when there are not users in the related room
            cluster.on('exit', function(worker, code, signal){
                delete slaveServers[getKeyByWorkerPid(worker.process.pid)];
            });
            //proxy the request after worker creates the server
            console.log("WORKERS: " + Object.keys(cluster.workers).length);
        }else{
            if (slaveServers[key].online)
                proxy.web(request, response, {target : "http://localhost:" + (config.port + (slaveServers[key].worker.process.pid % 1000))}, function(e){});
            else
                (function waitServerUp() {
                    //console.log("server is closed now, I wait ...");
                    if (slaveServers[key].online)
                        proxy.web(request, response, {target: "http://localhost:" + (config.port + (slaveServers[key].worker.process.pid % 1000))}, function (e) {  });
                    else
                        setTimeout(waitServerUp, 1000); //Gives the time to the server to open.
                })();
        }
    }

    if (cluster.isMaster) {
        console.log("MASTER ONLINE");
        http.createServer(assignSlave).listen(config.port, /*config.host*/'127.0.0.1');
    }else if(cluster.isWorker){
        let cloned_config = require('../config');
        cloned_config.port = (config.port  + (process.pid % 1000));
        server.createServer(cloned_config);
    }
};
