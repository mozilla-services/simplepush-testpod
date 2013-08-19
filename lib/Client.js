var events = require('events'),
    WebSock = require('ws'),
    moment = require('moment'),
    _ = require('underscore'),
    debug = require('debug')('client'),
    util = require('util'),
    EndPoint = require('./EndPoint')
    ;

var DOUT = (typeof(process.env.NODEBUG) == 'undefined');

function Client(server, proto, http, channelsToCreate) {
    this.server = server;
    this.uaid = "";
    this.channelIDs = [];
    this.connected = false;
    this.proto = proto;
    this.http = http;

    this.channelsToCreate = channelsToCreate;

    // keep a map of our own endpoints
    this.endpoints = { };
}

module.exports = Client;

util.inherits(Client, events.EventEmitter);

Client.prototype.connect = function() {
    var url = this.proto + this.server + '/';
    var opts = {
        origin: 'http://simplepush-testpod.mozilla.com/'
    };
    if(this.proto === 'wss://') {
        opts.rejectUnauthorized = false;
    }
    if (DOUT) debug('connecting to %s', url);
    this.ws = new WebSock(url, opts);
    this.ws.clientRef = this;
    this.connected_at = moment();
};

Client.prototype.helloHandler = function(m) {
    if (this.uaid === "") {
        if (DOUT) debug("Registered UAID: %s", m.uaid);
        this.uaid = m.uaid;
        this.emit('registered', this);
    } else {
        if (this.uaid === m.uaid) {
            // protocol says we should ignore these
            return; 
        } else {
            if (DOUT) debug("Got unexpected UAID %s", m.uaid);
            this.emit('ERR_UNEXPECTED_UAID', m.uaid);
        }
    }
};

Client.prototype.registerHandler = function(m) {
    if (DOUT) debug("Channel Registered: %s", m.pushEndpoint);
    if(_.isUndefined(m.pushEndpoint)) {
        this.emit('err_endpointundefined', new Error("Endpoint was undefined."));
        return;
    }
    this.channelIDs.push(m.channelID);
    var e = new EndPoint(
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

Client.prototype.wsOpenHandler = function() {
    this.clientRef.connected = true;
    this.clientRef.emit('open');
    this.clientRef.sendHello();
};

Client.prototype.wsCloseHandler = function() {
    this.clientRef.connected = false;
    this.clientRef.emit('close', moment().diff(this.connected_at));
};

Client.prototype.wsMessageHandler = function(message) {
    if (DOUT) debug("Received: %s", message);

    var m = JSON.parse(message);
    switch(m.messageType) {
    case 'hello':
        this.clientRef.helloHandler(m);
        break;

    // server has accepted registration of a channel
    case 'register':
        this.clientRef.registerHandler(m);
        break;

    case 'notification':
        this.clientRef.notificationHandler(m);
        break;
    }
};

Client.prototype.wsErrorHandler = function(err) {
    if (DOUT) debug(err);
}

Client.prototype.start = function() {
    this.connect();
    this.ws.on('open'    , this.wsOpenHandler);
    this.ws.on('close'   , this.wsCloseHandler);
    this.ws.on('message' , this.wsMessageHandler);
    this.ws.on('error'   , this.wsErrorHandler);

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
