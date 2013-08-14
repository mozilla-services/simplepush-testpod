/*
 * Main Application ... 
 */
define([
    'jquery'
    , "model/Stats"
    , "view/NumberFormatted"
    , "view/NumberBucket"
], function(
    $

    // models
    , StatsModel

    // views
    , NumberFormattedView
    , NumberBucketView
) {
    var statsModel = new StatsModel();

    $(function() {
        // update the UI when the stats model changes
        var numViews = [
            "conn_current"
            , "test_seconds"
            , "conn_attempted"
            , "conn_ok"
            , "conn_fail"
            , "conn_rate"
            , "ping_sent"
            , "ping_outstanding"
            , "ping_received"
            , "ping_duplicate"
            , "ping_failed"
            , "ping_avg"
            , "ping_median"
            , "ping_timeout"
            , "ping_rate"
        ];

        for(var i =0; i<numViews.length; i++) {
            new NumberFormattedView({
                model: statsModel
                , watch: numViews[i]
                , el : "#" + numViews[i]
            });
        }

        var pingTimesViews = [50, 100, 500, 1500, 5000, 10000, 'X'];
        for(var i=0; i<pingTimesViews.length; i++) {
            var k = 'p_t' + pingTimesViews[i] + 'ms';
            new NumberBucketView({
                model: statsModel
                , count: 'p_count'
                , watch: k
                , el: '#' + k
            });
        }

        var connTimeViews = [5, 30, 60, 300, 600, 1800, 'X'];
        for(var i=0; i<connTimeViews.length; i++) {
            var k = 'c_t' + connTimeViews[i] + 's';
            new NumberBucketView({
                model: statsModel
                , count: 'c_count'
                , watch: k
                , el: '#' + k
            });
        }
    });


    // startup a websocket connection
    var ws;
    var connectInterval = 1000;

    function startWS() {
        ws = new WebSocket("ws://"+window.location.hostname + ":" + window.location.port);
        ws.onerror = function(e) {
            $('#connectionStatus')
                .text('Error: ' + e)
                .attr('class', '')
                .addClass('disconnected');
        };

        ws.onopen = function(e) {
            $('#connectionStatus')
                .text('open')
                .attr('class', '')
                .addClass('connected');

            connectInterval = 1000;
        };

        ws.onmessage = function(e) {
            try {
                var data = JSON.parse(e.data);
            } catch(err) {
                console.log("WS JSON ERROR", err);
                return;
            }
            statsModel.set(data);
        };

        ws.onclose = function() {
            console.log("WS Waiting ", connectInterval, "ms before reconnecting");
            $('#connectionStatus')
                .text('Waiting ' + connectInterval + 'ms to retry')
                .attr('class', '')
                .addClass('disconnected');

            setTimeout(startWS, connectInterval);
        };
        connectInterval = Math.floor((connectInterval*1.5));
    }

    startWS();
});
