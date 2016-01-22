/*var checkPermissions = function (req, res, next) {



 }

 var setDatabase = function (req, res, next) {

 var domain = req.headers.host,
 subDomain = domain.split('.'),
 database = "default",
 config = sails.config["sequelize-magik-tenant"],
 getSubDomain = config.subDomain,
 getDatabaseName = config.tenantNames;

 if ((!getSubDomain) || (subDomain.length <= 1)) {
 req.db = database;
 return next();
 }

 database = subDomain[0];

 getSubDomain(database).then(function (mUser) {
 if (!mUser || !mUser[0]) {
 return next(new Error('Unknown user [' + database + ']'));
 }

 req.db = getDatabaseName(mUser[0] || mUser);
 return next();
 }).catch(function (err) {
 return next(err);
 });

 }

 module.exports = {

 checkUserPermissions: checkPermissions,

 setRequestDatabase: setDatabase

 }*/

module.exports = function routeHandling() {

    var self = this;

    return function handleRoutes(req, res, next) {
        console.log(self.configKey);
        var domain          = req.headers.host,
            subDomain       = domain.split('.'),
            database        = "default",
            config          = sails.config["magik-tenant"],
            getSubDomain    = config.subDomain,
            getDatabaseName = config.tenantNames;

        if ((!getSubDomain) || (subDomain.length <= 1)) {
            req.db = database;
            return next();
        }

        database = subDomain[0];

        return getSubDomain(database).then(function (mUser) {
            if (!mUser || !mUser[0]) {
                return next(new Error('Unknown user [' + database + ']').message);
            }

            req.db = getDatabaseName(mUser[0] || mUser);
            return next();
        }).catch(function (err) {
            return next(err.message);
        });

    }

};
