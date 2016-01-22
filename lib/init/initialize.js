"use strict";

var ModelLoader = require('../migrations/model_loader'),
    Utils = require('./utils');

module.exports = function hookInit(sails) {

    return function initialize(callback) {

        // initialize adapters
        if (!sails.adapters) {
            sails.adapters = {};
        }

        //initialize models
        if (!sails.models) {
            sails.models = {};
        }

        let modelLoader = new ModelLoader(sails);

        Utils.configurePubSub(sails);

        return modelLoader.run().then(function() {
            nrp.emit('end_loading', {emitter: nrp_id});
            return callback();
        }).catch(function(err) {
            nrp.emit('quit', {});
           return callback(err);
        });

    };

};
