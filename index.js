
module.exports = function magikTenant(sails) {

    return {

        defaults: require('./lib/init/defaults'),

        configure: require('./lib/init/configure')(sails),

        initialize: require('./lib/init/initialize')(sails),

        routes: {
            before: {
                '/*': require('./lib/routes/index')()
            }
        }

    };
};
