/**
 * Sequelize storage taken (and modified) of https://github.com/sequelize/umzug
 */

var _        = require('lodash'),
    redefine = require('redefine');

module.exports = redefine.Class({
    constructor: function (options) {
        this.options                = options || {};
        this.options.storageOptions = _.assign({
            modelName: 'SequelizeMeta',
            columnName: 'name'
        }, this.options.storageOptions || {});

        if (!this.options.storageOptions.model && !this.options.storageOptions.sequelize) {
            throw new Error('One of "sequelize" or "model" storage option is required');
        }

        // initialize model
        if (!this.options.storageOptions.model) {
            var sequelize  = this.options.storageOptions.sequelize;
            var modelName  = this.options.storageOptions.modelName;
            var Sequelize  = sequelize.constructor;
            var columnType = this.options.storageOptions.columnType || Sequelize.STRING;

            if (sequelize.isDefined(modelName)) {
                this.options.storageOptions.model = sequelize.model(modelName);
            } else {
                var attributes = {};

                attributes[this.options.storageOptions.columnName] = {
                    type: columnType,
                    allowNull: false,
                    unique: true,
                    primaryKey: true,
                    autoIncrement: false
                };

                this.options.storageOptions.model = sequelize.define(
                    modelName,
                    attributes,
                    {
                        tableName: this.options.storageOptions.tableName,
                        schema: this.options.storageOptions.schema,
                        timestamps: false
                    }
                );
            }
        }
    },

    logMigration: function (migrationName) {
        var self = this;

        return this._model()
            .sync()
            .then(function (Model) {
                var migration                                     = {};
                migration[self.options.storageOptions.columnName] = migrationName;
                return Model.create(migration);
            });
    },

    unlogMigration: function (migrationName) {
        var self             = this;
        var sequelize        = this.options.storageOptions.sequelize;
        var sequelizeVersion = !!sequelize.modelManager ? 2 : 1;

        return this._model()
            .sync()
            .then(function (Model) {
                var where                                     = {};
                where[self.options.storageOptions.columnName] = migrationName;

                if (sequelizeVersion > 1) {
                    // This is an ugly hack to find out which function signature we have to use.
                    where = {where: where};
                }

                return Model.destroy(where);
            });
    },

    executed: function () {
        var self = this;

        return this._model()
            .sync()
            .then(function (Model) {
                return Model.findAll({order: [[self.options.storageOptions.columnName, 'ASC']]});
            })
            .then(function (migrations) {
                return migrations.map(function (migration) {
                    return migration[self.options.storageOptions.columnName];
                });
            });
    },
    _model: function () {
        return this.options.storageOptions.model;
    }
});

//module.exports = SequelizeStorage;
