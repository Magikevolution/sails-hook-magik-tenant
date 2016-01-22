"use strict";

var Bluebird = require('bluebird'),
    util     = require('util');

var ModelLoader = class ModelLoader {

    constructor(sailsInstance) {
        this._sailsInstance     = sailsInstance;
        this._loadModels        = Bluebird.promisify(this._sailsInstance.modules.loadModels);
        this._config            = this._sailsInstance.config["magik-tenant"];
        this._connectionName    = this._config.defaultConnection || "defaultConnection";
        this._connection        = this._sailsInstance.config.connections[this._connectionName];
        this._migrationStrategy = this._sailsInstance.config.models.migrate;
    }

    _initConnection(dbName, connection) {
        if (!global['Sequelize']) global['Sequelize'] = {};
        if (!global['sequelize']) global['sequelize'] = {};
        global.Sequelize[dbName] = require('sequelize');
        Sequelize[dbName].cls    = require('continuation-local-storage').createNamespace('sails-sequelize-' + dbName);
        if (!connection.options) {
            connection.options = {};
        }
        //sequelize will use sails logging feature. cool, right?
        connection.options.logging = this._config.log.verbose;
        global.sequelize[dbName]   = new global.Sequelize[dbName](connection.database, connection.user, connection.password, connection.options);
    }

    run() {
        let self = this;
        return new Bluebird(function (resolved, rejected) {
            let tenantModels = [];
            if (!self._connection) {
                return rejected(new Error(util.format('Connection [%s] not found in config/connections', self._connectionName)));
            }
            self._initConnection('default', self._connection);

            self._config.log.verbose(util.format("Main connection: %s", self._connectionName));

            return self._loadModels().then(function (models) {

                //var modelDef, modelName;
                //if (err) {
                //    return callback(err);
                //}

                let mainModelKeys = [];

                _.each(Object.keys(models), function (modelName) {
                    let modelDefinition = models[modelName], index = self._config.modelExclusion.indexOf(modelName);
                    if (index != -1) {
                        self._config.log.verbose(util.format('Loading model [%s]', modelDefinition.globalId));
                        global[modelDefinition.globalId]                                          = global.sequelize['default'].define(modelDefinition.globalId, modelDefinition.attributes, modelDefinition.options);
                        self._sailsInstance.models[modelDefinition.globalId.toLowerCase()] = global[modelDefinition.globalId];
                        mainModelKeys.push(modelName);
                    } else {
                        self._config.log.verbose(util.format('Model [%s] is a tenant model.', modelDefinition.globalId));
                        tenantModels.push(models[modelName].identity);
                    }
                });

                self._config.tenantModels = tenantModels;

                _.each(mainModelKeys, function (value) {
                    let modelDefinition = models[value];
                    self._setAssociation(modelDefinition);
                    self._setDefaultScope(modelDefinition);
                });

                return global.sequelize.default.sync({force: false});
            }).then(function () {
                let getTenantsConfig = self._config.tenantConfig.getTenants;
                //getTenantConnection = sails.config[this.configKey].tenantConfig;
                //databaseConfig = {};
                if (!getTenantsConfig) {
                    throw new TypeError("Unable to get tenants. Define the property [tenantConfig] in this module configuration.")
                }
                return getTenantsConfig();
            }).then(function (tenants) {
                return self._initTenants(tenants, tenantModels);
            }).then(function () {
                return resolved();
            }).catch(function (err) {
                return rejected(err);
            });
        });
    }

    _initTenants(tenants, tenantModels) {
        var self = this;
        return new Bluebird(function (resolved, rejected) {
            if (!tenants || !tenants[0]) {
                return resolved();
            }
            let getTenantName = self._config.tenantNames;

            if (!getTenantName) {
                return rejected(new TypeError("Unable to get tenants. Define the property [tenantNames] in this module configuration."));
            }

            let mQueue = async.queue(function (task, callback) {
                return self.initTenant(task).then(function () {
                    return callback();
                }).catch(function (err) {
                    return callback(err);
                });
            }, 1);

            mQueue.drain = function () {
                return resolved();
            }

            mQueue.pause();

            _.each(tenants, function (tenant) {
                let tenantDbName       = getTenantName(tenant),
                    tenantDbConnection = _.cloneDeep(self._connection);
                //disable connection pooling for now
                //possible memory problem if active with many tenants??
                if (tenantDbConnection.pool) tenantDbConnection.pool = false;
                tenantDbConnection.database = tenantDbName;
                mQueue.push({
                    connection: tenantDbConnection,
                    models: tenantModels
                }, function (err) {
                    if (err) {
                        self._config.log.verbose(util.format('Tenant [%s] initialization ended with errors.', tenantDbName));
                    } else {
                        self._config.log.verbose(util.format('Tenant [%s] initialization ended.', tenantDbName));
                    }
                });
            });

            mQueue.resume();
        });
    }

    _createDatabase(newDbName) {
        var self = this;
        return new Bluebird(function (resolved, rejected) {
            return sequelize['default'].query("CREATE DATABASE " + newDbName, {raw: true}).then(function () {
                return resolved();
            }).catch(function (err) {
                if (err.original.code === 'ER_DB_CREATE_EXISTS') {
                    self._config.log.silly(util.format("Database %s already exists.", newDbName));
                    //ignore this
                    return resolved();
                }
                return rejected(err);
            });
        });

    }

    _setAssociation(modelDef) {
        if (modelDef.associations) {
            self._config.log.verbose(util.format('Loading associations for [%s]', modelDef.globalId));
            if (typeof modelDef.associations === 'function') {
                modelDef.associations(modelDef);
            }
        }
    }

    _setDefaultScope(modelDef) {
        if (modelDef.defaultScope) {
            self._config.log.verbose(util.format('Loading default scope for [%s]', modelDef.globalId));
            if (typeof modelDef.defaultScope === 'function') {
                let defaultScope = modelDef.defaultScope() || {};
                global[modelDef.globalId].addScope('defaultScope', defaultScope, {override: true});
            }
        }
    }

    initTenant(task) {
        var self = this;
        return new Bluebird(function (resolved, rejected) {
            let dbName = task.connection.database;
            self._initConnection(dbName, task.connection);
            return self._createDatabase(task.connection.database).then(function () {
                return self._loadModels();
            }).then(function (models) {
                let tenantModels = _.pick(models, function (value, key) {
                    return (task.models.indexOf(key) !== -1);
                });

                _.each(Object.keys(tenantModels), function (modelName) {
                    let modelDefinition = tenantModels[modelName];
                    self._config.log.verbose(util.format('Loading tenant model [%s]', modelDefinition.globalId));
                    if (!global[modelDefinition.globalId]) global[modelDefinition.globalId] = {};
                    global[modelDefinition.globalId][dbName] = global.sequelize[dbName].define(modelDefinition.globalId, modelDefinition.attributes, modelDefinition.options);
                    if (!self._sailsInstance.models[modelDefinition.globalId.toLowerCase()]) {
                        self._sailsInstance.models[modelDefinition.globalId.toLowerCase()] = {};
                    }
                    self._sailsInstance.models[modelDefinition.globalId.toLowerCase()][dbName] = global[modelDefinition.globalId][dbName];
                });

                _.each(Object.keys(tenantModels), function (modelName) {
                    let modelDefinition = models[modelName];
                    self._setAssociation(modelDefinition);
                    self._setDefaultScope(modelDefinition);
                });
                return global.sequelize[dbName].sync({force: false});
            }).then(function () {
                return resolved();
            }).catch(function (err) {
                return rejected(err);
            });
        });
    }

}


module.exports = ModelLoader;
