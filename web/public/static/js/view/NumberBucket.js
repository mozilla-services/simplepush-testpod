define(['jquery', 'backbone'], function($, Backbone) {
    return Backbone.View.extend({
        initialize: function(options) {

            if (!options || !options.watch || !options.count) {
                throw new Error("missing an option");
            }

            var evt = "change:"+options.watch;
            var self = this;
            options.model.listenTo(options.model, evt, function(m, v) {
                var c = m.get(options.count);
                var pct = 0;
                if (c > 0) {
                    pct = Math.floor(v / c * 10000)/100
                }
                self.$el.text(v + " (" + pct + "%)");
            });
        }
    });
});
