if (typeof define !== 'function') { var define = require('amdefine')(module) }
define( function(require,exports,module) {

var _ = require('underscore');
var $ = require('jquery');
var Events = require('backbone').Events;
var SockJS = require('sockjs-client');
var config = require('../config');

//var eioclient = require('../node_modules/engine.io-client/engine.io');

var PubSubSocket = module.exports = function(channel,socket_id,websocket,es){
    self = this;
    this.es                 = es;
    this.connection_is_open = false;
    //this.retryTime = 0;
    //this.prevRetryTime = 0;
    //this.loginTimeout = 15;

    this.connectionRetry = function(){
       //this.retryTime = this.prevRetryTime +(0.08 * this.loginTimeout);
        $('#connection_status_message').html("Connection lost, try to reconnect ...");
        $('#es-header').css('background-color', '#F44336');
        //var timeout = setTimeout(function(){
            self.initWebsocket(channel,socket_id,websocket);
          //  clearTimeout(timeout);
        //}, this.retryTime);

    };

    this.open_handler = function(){
        //this.retryTime = 0;
        //this.prevRetryTime = 0;
        //this.connection_is_open = true;
        $('#connection_status_message').html("Online");
        $('#es-header').css('background-color', '#4CAF50');
        $('#offline_overlay').css('display','block');
        //this.es.sendUnsendedCommands();
    };

    this.close_handler = function(){
      /*$('#es-modal-box').html("<h1>Your connection to the server has been lost, please refresh the page.</h1>");
       $('#es-modal-overlay').show();*/
      this.connection_is_open = false;
      $('#offline_overlay').css('display','block');
      //this.prevRetryTime = this.retryTime;
      this.connectionRetry();
    };

    this.error_handler = function(){
        this.connection_is_open = false;
        //this.prevRetryTime = this.retryTime;
        //this.connectionRetry();
    };

    this.message_handler = function(){};

    this.initWebsocket(channel,socket_id,websocket);

};

_.extend(PubSubSocket.prototype, Events,{

  recInterval : null,
  channel: null,
  socket_id: null,
  websocket: null,

  initWebsocket: function(channel,socket_id,websocket){
    this.channel   = channel;
    this.socket_id = socket_id;
    this.websocket = websocket;

    //SockJs
    //this.ws = websocket || new SockJS(window.location.protocol + '//' + window.location.host +'/'+ channel +'/pubsub/',{debug:false,devel:false});
    this.ws = websocket || new SockJS(window.location.protocol + '//' + window.location.host +'/ethersheet/'+ channel +'/pubsub/', null, {
          'protocols_whitelist': [
            /*'websocket',
            'xdr-streaming',*/
            /*'iframe-eventsource',
            'iframe-htmlfile',*/
            /*'xdr-polling',*/
            'xhr-streaming',
            'xhr-polling',
            'iframe-xhr-polling',
            'jsonp-polling']
        });
     this.ws.onopen = _.bind(this.open,this);
     this.ws.onerror= _.bind(this.error,this);
     this.ws.onclose = _.bind(this.close,this);
     this.ws.onmessage = _.bind(this.message,this);

    //Engine.io
    /*this.ws = new eioclient( window.location.protocol + '//' + window.location.host  + '/pubsub/' + channel , { transports :['polling'], requestTimeout: 0 } );
    //this.ws.binaryType = 'blob';

    var self = this;
    this.ws.on('open', function(){
        self.open_handler();
    });
    this.ws.on('pollComplete', function(){
          self.open_handler();
    });
    this.ws.on('close', function(){
        self.close_handler();
    });
    this.ws.on('message', function (data) {
        var e = { data : data};
        self.message_handler(e);
    });
    this.ws.on('error', function (e) {
        self.error_handler(e);
    });*/
  },

  onMessage: function(handler){
    this.message_handler = handler;
  },

  message: function(e){
    this.message_handler(e);
  },

  onOpen: function(handler){
    this.open_handler = handler;
  },
  
  open: function(e){
    this.open_handler(e);
  },

  onClose: function(handler){
    this.close_handler = handler;
  },
  
  close: function(e){
    this.close_handler(e);
  },

  onError: function(handler){
    this.error_handler = handler;
  },
  
  error: function(e){
    this.error_handler(e);
  },

  send: function(msg){
    try {
      this.ws.send(msg);
    }catch(e){
      console.log(e);
      $('#es-modal-box').html("<h1>There are some problems with server it could be unreachable :(</h1>");
      $('#es-modal-overlay').show();
    }
  }
});

});
