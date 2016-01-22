module.exports = {
    __configKey__: {
        //the name of this hook (hello, captain obvious)
        name: "sequelize-magik-tenant",
        //a list of the models that do not perform their actions on tenants (application-specific tables)
        modelExclusion: [],
        //function that returns a promise that, when executed, gives a list of tenants
        //example: function() { return User.findAll(); }
        tenantConfig: {
            modelName : null,
            getTenants: null
        },
        //function that returns the database names, given one tenant row
        //example: function(userRow) { return userRow.name + "_" + userRow.lastName; }
        //MUST BE A SYNCHRONOUS FUNCTION
        tenantNames: false,
        //function that returns a connection object
        //must return a valid sequelize connection object
        //see http://docs.sequelizejs.com/en/latest/docs/getting-started/?highlight=connection#setting-up-a-connection
        //MUST BE A SYNCHRONOUS FUNCTION
        //tenantConnection: false,
        //the default connection we will be using
        //(application-specific database connection)
        defaultConnection: "defaultConnection",
        //OPTIONAL: this specifies if our app will run on a subDomain way.
        //For example, if you want your tenant data to be accessible by specifying a different subdomain for each one
        //will receive the subdomain as parameter and must return a promise that, when executed, gives the tenant in question
        //example: subDomain: function(PARAMETER) { return User.findAll({where:{name: PARAMETER}}); }
        subDomain: false,

        redisOptions: {
            host: '127.0.0.1',
            port: 6379,
            scope: 'tenantPubSub'
        }
    }
};
