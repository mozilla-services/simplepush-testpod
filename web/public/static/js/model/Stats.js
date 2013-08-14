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
            , test_seconds: 0

            // Connection Stats
            , conn_attempted : 0
            , conn_ok        : 0
            , conn_fail      : 0
            , conn_rate      : 100

            // Connection Times
            , c_count  : -1
            , c_t5s    : -1
            , c_t30s   : -1
            , c_t60s   : -1
            , c_t300s  : -1
            , c_t600s  : -1
            , c_t1800s : -1
            , c_tXs    : -1

            // Ping Stats
            , ping_sent        : -1
            , ping_outstanding : -1
            , ping_received    : -1
            , ping_duplicate   : -1
            , ping_failed      : -1
            , ping_avg         : -1
            , ping_median      : -1
            , ping_timeout     : -1
            , ping_rate        : -1

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
                var a = m.get('conn_attempted');
                if (a == 0) return;

                var rate = Math.round(m.get('conn_ok')/a*100);
                m.set('conn_rate', rate);
            });

            this.on('change:ping_sent change:ping_received', function(m) {
                var s = m.get('ping_sent');
                if (s == 0) return;
                var rate = Math.round(m.get('ping_received')/s*100);
                m.set('ping_rate', rate);
            });
        }
    });
});
