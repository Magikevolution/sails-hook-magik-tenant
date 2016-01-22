"use strict";

var fs        = require('fs'),
    Bluebird  = require('bluebird'),
    path      = require('path'),
    Migration = require(path.resolve(__dirname, '../migrations/index')),
    Nrp       = require('node-redis-pubsub'),
    _         = require('lodash'),
    util      = require('util'),
    uuid      = require('node-uuid'),
    ModelLoader = require('../migrations/model_loader');

var Utils = class Utils {

    constructor() {
    }

    static _onLoadEnd(sailsInstance, data) {
        var self = this;
        if (global.migration_running === false) {
            global.migration_running = true;
            if (data.emitter === global.nrp_id) {
                var mQueue = async.priorityQueue(function (task, callback) {
                    return self.runMigrations(task.connection, sailsInstance, task.isMainDB).then(function () {
                        return callback();
                    }).catch(function (err) {
                        return callback(err);
                    })
                }, 1);

                mQueue.drain = function () {
                    return global.nrp.emit('migration_ended', {});
                }

                mQueue.pause();

                mQueue.push({connection: global.sequelize['default'], isMainDB: true}, 0, function (err) {
                    if (err) {
                        global.nrp.quit();
                        mQueue.pause();
                        mQueue.kill();
                        throw err;
                    }
                });

                _.each(Object.keys(global.sequelize), function (key) {
                    if (key != "default") {
                        mQueue.push({connection: global.sequelize[key], isMainDB: false}, 10, function (err) {
                            if (err) {
                                mQueue.pause();
                                mQueue.kill();
                                throw err;
                            }
                        });
                    }
                });

                mQueue.resume();
            }
            nrp.off('end_loading');
        }
    }

    static _onLoadTenant(sailsInstance, data) {
        let tenantDbName       = sailsInstance.config["magik-tenant"].tenantNames(data.tenant),
            connectionName     = sailsInstance.config["magik-tenant"].defaultConnection,
            tenantDbConnection = _.clone(sailsInstance.config.connections[connectionName]);
        //disable connection pooling for now
        //possible memory problem if active with many tenants??
        if (tenantDbConnection.pool) tenantDbConnection.pool = false;
        tenantDbConnection.database = tenantDbName;
        let modelLoader = new ModelLoader(sails), self = this;
        return modelLoader.initTenant({connection: tenantDbConnection, models: sailsInstance.config["magik-tenant"].tenantModels}).then(function() {
            return self.runMigrations(global.sequelize[tenantDbName], sailsInstance, false);
        }).then(function() {
            sailsInstance.log.verbose(util.format('Tenant [%s] initialization ended.', tenantDbName));
        }).catch(function(err) {
            sailsInstance.log.verbose(util.format('Tenant [%s] initialization ended with errors.', tenantDbName));
        });
    }

    static _onMigrationEnd(sailsInstance) {
        global[sailsInstance.config["magik-tenant"].tenantConfig.modelName].afterCreate(function (tenantInst) {
            global.nrp.emit('load_tenant', {tenant: JSON.parse(JSON.stringify(tenantInst))});
        });
    }

    static existsPath(folderPath, mode) {
        return new Bluebird(function (resolved, rejected) {
            return fs.access(folderPath, mode, function (err) {
                return resolved((err) ? false : true);
            });
        });
    }

    static createFolder(folderPath) {
        return new Bluebird(function (resolved, rejected) {
            return fs.mkdir(folderPath, function (err) {
                if (err && err.code !== 'EEXIST') {
                    return rejected(err);
                }
                return resolved();
            });
        });
    }

    static createFolderIfNotExists(folderPath) {
        let self = this;
        return new Bluebird(function (resolved, rejected) {
            return self.existsPath(folderPath, fs.F_OK).then(function (folderExists) {
                if (!folderExists) {
                    return self.createFolder(folderPath);
                }
            }).then(function () {
                return resolved();
            }).catch(function (err) {
                return rejected(err);
            })
        })
    }

    static createMigrationDirectories() {
        let self = this;
        return new Bluebird(function (resolved, rejected) {

            return self.createFolderIfNotExists(global.appRootPath + '/config/database').then(function () {
                return self.createFolderIfNotExists(global.appRootPath + '/config/database/migrate');
            }).then(function () {
                return self.createFolderIfNotExists(global.appRootPath + '/config/database/migrate/tenants');
            }).then(function () {
                return self.createFolderIfNotExists(global.appRootPath + '/config/database/migrate/main');
            }).then(function () {
                //all promises resolved
                return resolved();
            }).catch(function (err) {
                return rejected(err);
            });
        });
    }

    static runMigrations(sequelizeInstance, sailsInstance, isMainDB) {
        let self = this;
        return new Bluebird(function (resolved, rejected) {
            let migration;

            return self.createMigrationDirectories().then(function () {
                migration = new Migration(sequelizeInstance, sailsInstance, isMainDB);
                return migration.run();
            }).then(function () {
                migration.dispose();
                return resolved();
            }).catch(function (err) {
                if (migration) {
                    migration.dispose();
                }
                return rejected(err);
            });
        });
    }

    static configurePubSub(sailsInstance) {
        global.nrp               = global.nrp || new Nrp(sailsInstance.config["magik-tenant"].redisOptions);
        global.nrp_id            = global.nrp_id || uuid.v1();
        global.migration_running = false;
        var self                 = this;
        nrp.on('migration_ended', function () {
            return self._onMigrationEnd(sailsInstance);
        });
        nrp.on('load_tenant', function (data) {
            return self._onLoadTenant(sailsInstance, data);
        });
        nrp.on('end_loading', function (data) {
            return self._onLoadEnd(sailsInstance, data);
        });
    }
}

module.exports = Utils;
