var events = require('events'),
    WebSock = require('ws'),
    moment = require('moment'),
    _ = require('underscore'),
    debug = require('debug')('client'),
    util = require('util'),
    EndPoint = require('./EndPoint')
    ;

var DOUT = (typeof(process.env.NODEBUG) == 'undefined');

function Client(server, proto, http) {
    this.server = server;
    this.uaid = "";
    this.channelIDs = [];
    this.connected = false;
    this.proto = proto;
    this.http = http;

    // keep a map of our own endpoints
    this.endpoints = { };
}

module.exports = Client;

util.inherits(Client, events.EventEmitter);

Client.prototype.connect = function() {
    var url = this.proto + this.server + '/';
    var opts = {};
    if(this.proto === 'wss://') {
        opts = {rejectUnauthorized: false};
    }
    if (DOUT) debug('connecting to %s', url);
    this.ws = new WebSock(url, opts);
    this.connected_at = moment();
};

Client.prototype.helloHandler = function(m) {
    if (DOUT) debug("Registered UAID: %s", m.uaid);
    this.uaid = m.uaid;
    this.emit('registered', m.uaid);
};

Client.prototype.registerHandler = function(m) {
    if (DOUT) debug("Channel Registered: %s", m.pushEndpoint);
    if(_.isUndefined(m.pushEndpoint)) {
        this.emit('error', new Error("Endpoint was undefined."));
        return;
    }
    this.channelIDs.push(m.channelID);
    var e =  new EndPoint(
        this.http, this, m.pushEndpoint, m.channelID, 0 
    );
    this.endpoints[m.channelID] = e;
    this.emit('newendpoint', e);
};

Client.prototype.notificationHandler = function(m) {
    var self = this;
    var msg = {'messageType': 'ack',
               'updates': m.updates};
    self.send(JSON.stringify(msg));
    if(_.isArray(m.updates)) {
        m.updates.forEach(function(v) {
            if (self.endpoints[v.channelID]) {
                self.endpoints[v.channelID].updateVersion(v.version);
            }
        });
    } else {
        self.emit('err_notification_empty', new Error('notification did not contain updates.'));
    }
};

Client.prototype.send = function(m, cb) {
    if (DOUT) debug("Sending: %s", m);
    this.ws.send(m, cb);
};

Client.prototype.start = function() {
    var self = this;
    self.connect();
    self.ws.on('open', function() {
        self.connected = true;
        self.emit('open');
        self.sendHello();
    });

    self.ws.on('close', function() {
        self.connected = false;
        self.emit('close', moment().diff(self.connected_at));
    });
    
    self.ws.on('message', function(message) {
        if (DOUT) debug("Received: %s", message);
        var m = JSON.parse(message);
        switch(m.messageType) {
        case 'hello':
            self.helloHandler(m);
            break;
        case 'register':
            self.registerHandler(m);
            break;
        case 'notification':
            self.notificationHandler(m);
            break;
        }
    });

    self.ws.on('error', function(err) {
        if (DOUT) debug(err);
    });

};

Client.prototype.sendHello = function() {
    var msg = {'messageType': "hello",
               'uaid': this.uaid,
               'channelIDs': this.channelIDs};
    this.send(JSON.stringify(msg));
};

Client.prototype.registerChannel = function(chanId) {
    var self = this;
    this.on('registered', function() {
        var msg = {'messageType': "register",
                   'uaid': self.uaid,
                   'channelID': chanId};

        self.send(JSON.stringify(msg));
    });
};
