"use strict";

var path = require('path');
module.exports = function hookConfig(sails) {
    return function configure() {

        //this is essentially for testing purposes
        //detect if appPath equals to hook root and correct it
        //if (sails.config.appPath == path.resolve(__dirname, '../')) {
        //    sails.config.appPath = path.resolve(sails.config.appPath, '../../');
        //}
        //sails.log.error(sails.config.appPath);

        //exposing global app root path
        global.appRootPath = sails.config.appPath;
        //exposing hook root path on global variables
        //and a funny variable name :D
        global.hookRoot = path.resolve(__dirname);

        let configurationPath = path.resolve(global.appRootPath, 'config/magik-tenant'),
            configuration = {};


        //The call to require() throws an Error if the file is not defined
        //If that happens, we cannot continue because we need user's info (model_exclusion)
        //Just log that and return (we have active=false in the default settings, so the hook will never run).
        try {
            configuration = require(configurationPath);
        } catch (e) {
            throw e;
        }

        //Enforce the configuration to have a valid model_exclusion Array
        if(!configuration['modelExclusion'] || configuration['modelExclusion'].constructor != Array) {
            throw new ReferenceError('No models properly defined in configuration (model_exclusion).');
        }

        if(!configuration['tenantNames'] || !(typeof configuration['tenantNames'] === 'function')) {
            throw new ReferenceError('There is no tenantNames defined.');
        }

        //if(!configuration['tenantConnection'] || !(typeof configuration['tenantConnection'] === 'function')) {
        //    throw new ReferenceError('There is no tenantConnection defined.');
        //}

        if(!configuration['tenantConfig'] || !(typeof configuration['tenantConfig'] === 'object') || !(configuration['tenantConfig'].modelName)) {
            throw new ReferenceError('There is no tenantConfig defined.');
        }

        if(!configuration['defaultConnection'] || !(typeof configuration['defaultConnection'] === 'string')) {
            throw new ReferenceError('There is no defaultConnection defined.');
        }

        let tempConfig = sails.config[this.configKey];
        tempConfig.modelExclusion = configuration['modelExclusion'];
        tempConfig.tenantNames = configuration['tenantNames'];
        //tempConfig.tenantConnection = configuration['tenantConnection'];
        tempConfig.tenantConfig = configuration['tenantConfig'];
        if(typeof tempConfig.tenantConfig.getTenants !== 'function') {
            tempConfig.tenantConfig.getTenants = function() {
                return global[tempConfig.tenantConfig.modelName].findAll();
            }
        }
        tempConfig.defaultConnection = configuration['defaultConnection'];
        tempConfig.subDomain = configuration['subDomain'] || false;
        tempConfig.log = sails.log;
        tempConfig.redisOptions = configuration['redisOptions'] || tempConfig.redisOptions;
        sails.config[this.configKey] = tempConfig;
    }
}
