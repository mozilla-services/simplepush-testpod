# SimplePush TestPod

This creates an Application Server and a group of clients that performs end to
end load testing on Mozilla's [SimplePush](https://wiki.mozilla.org/WebAPI/SimplePush) service.

## Installing
```
git clone https://github.com/oremj/simplepush-testpod.git
cd simplepush-testpod
npm install
```

## Running a basic test
```
node master.js -S -s push.stage.mozaws.net \
    -w NUMWORKERS \
    -c NUMCLIENTS \
    -C CHANNELSPERCLIENT
```


## How this tester works

* It spins up a fake App Server that will send Push notifications to clients
* The clients also run locally, thousands at a time, connecting via secure websockets
  to a SimplePush server
* The App Server portion pushes a notification and waits for the message to come back
  from the SimplePush server

## Test Data Collected

Statistics are collected for: 

* Server
    * Pushes (HTTP) failed and succeeded
* Client 
    * Succesful / Failed handshake w/ push server
    * Notifications expected + recieved
    * Push latency, time between AppServer sending push and Client receiving it


## Debug Output
* To print debug output, run like `DEBUG=* node index.js`.
