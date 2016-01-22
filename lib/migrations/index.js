"use strict";

var path       = require('path'),
    Umzug      = require('umzug'),
    Bluebird   = require('bluebird');
var Migrations = class Migrations {
    constructor(sequelizeInstance, sailsInstance, isMainDB) {
        this._umzug = new Umzug({
            storage: path.resolve(__dirname, 'sequelizeStorage'),

            storageOptions: {
                sequelize: sequelizeInstance
            },

            logging: sailsInstance.log,

            upName: 'up',

            downName: 'down',

            migrations: {
                params: [sequelizeInstance.getQueryInterface(), sequelizeInstance.constructor],

                path: path.resolve(global.appRootPath, './config/database/migrate', isMainDB ? ('main') : ('tenants')),

                pattern: /^\d+[\w-]+\.js$/,

                wrap: function (fun) {
                    return fun;
                }

            }
        });
    }

    run() {
        var self = this;
        return new Bluebird(function (resolved, rejected) {
            return self._umzug.up().then(function (executedMigrations) {
                return resolved();
            }).catch(function (err) {
                return rejected(err);
            });
        });
    }

    /**
     * Perhaps a little help improving GC??
     */
    dispose() {
        if (this._umzug) {
            this._umzug = null;
        }

    }
}

module.exports = Migrations;
