var events = require('events'),
    WebSocket = require('ws'),
    util = require('util');


function Client(server) {
    this.server = server;
    this.uaid = "";
    this.ws = new WebSocket('ws://' + this.server + '/');
}

module.exports = Client;

util.inherits(Client, events.EventEmitter);

Client.prototype.helloHandler = function(m) {
    console.log("Registered UAID: %s", m.uaid);
    this.uaid = m.uaid;
    this.emit('registered');
}

Client.prototype.send = function(m) {
    console.log("Sending: %s", m);
    this.ws.send(m);
}

Client.prototype.start = function() {
    self = this;
    self.ws.on('open', function() {
        self.sendHello();
    });
    
    self.ws.on('message', function(message) {
        var m = JSON.parse(message);
        console.log("Received: %s", m);
        switch(m['messageType']) {
            case 'hello':
                self.helloHandler(m);
                break;
        }
    });

    self.ws.on('error', function(err) {
        console.log(err);
    });

}

Client.prototype.sendHello = function() {
    var msg = {'messageType': "hello",
               'uaid': "",
               'channelIDs': []}
    this.send(JSON.stringify(msg));
}

Client.prototype.registerChannel = function(chanId) {
    self = this;
    this.on('registered', function() {
        var msg = {'messageType': "register",
                   'uaid': self.uaid,
                   'channelID': self.chanId};

        this.send(JSON.stringify(msg));
    });
}
