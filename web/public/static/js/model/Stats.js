define([
    "_"
    , "backbone"
], function(
    _
    , Backbone
) {
    return Backbone.Model.extend({
        defaults: {
            // current connections
            conn_current: 0

            // Connection Stats
            , conn_attempted : 0
            , conn_ok        : 0
            , conn_fail      : 0
            , conn_rate      : 100


            // Connection Times

            // Ping Stats
            , ping_sent     : 0
            , ping_received : 0
            , ping_timeout  : 0
            , ping_rate     : 12
            , ping_avg      : 0
            , ping_median   : 0

            // ping latency
            , p_count    : -1
            , p_t50ms    : -1
            , p_t100ms   : -1
            , p_t500ms   : -1
            , p_t1500ms  : -1
            , p_t5000ms  : -1
            , p_t10000ms : -1
            , p_X        : -1
        }

        , initialize: function(options) {

            this.on('change:conn_attempted change:conn_ok', function(m) {
                var rate = Math.round(m.get('conn_ok')/m.get('conn_attempted')*100);
                m.set('conn_rate', rate);
            });

            this.on('change:ping_sent change:ping_received', function(m) {
                var rate = Math.round(m.get('ping_received')/m.get('ping_sent')*100);
                m.set('ping_rate', rate);
            });
        }
    });
});
