var events = require('events'),
    WebSock = require('ws'),
    util = require('util');


function Client(server) {
    this.server = server;
    this.uaid = "";
    this.channelIDs = [];
    this.ws = new WebSock('ws://' + this.server + '/');
}

module.exports = Client;

util.inherits(Client, events.EventEmitter);

Client.prototype.helloHandler = function(m) {
    console.log("Registered UAID: %s", m.uaid);
    this.uaid = m.uaid;
    this.emit('registered', m.uaid);
};

Client.prototype.registerHandler = function(m) {
    console.log("Channel Registered: %s", m.pushEndpoint);
    this.channelIDs.push(m.channelID);
    this.emit('pushendpoint', m.pushEndpoint, m.channelID);
};

Client.prototype.notificationHandler = function(m) {
    var self = this;
    var msg = {'messageType': 'ack',
               'updates': m.updates};
    self.send(JSON.stringify(msg));
    m.updates.forEach(function(v) {
        self.emit('channelupdate', v.channelID, v.version);
    });
};

Client.prototype.send = function(m) {
    console.log("Sending: %s", m);
    this.ws.send(m);
};

Client.prototype.start = function() {
    var self = this;
    self.ws.on('open', function() {
        self.sendHello();
    });
    
    self.ws.on('message', function(message) {
        console.log("Received: %s", message);
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
        console.log(err);
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
