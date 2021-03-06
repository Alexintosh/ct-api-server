'use-strict';

var _ = require('underscore');
var async = require('async');
var express = require('express');
var querystring = require('querystring');

var manager = require('../../../manager');
var app = manager.app;
var BitcoindZeroMQ = app.lib.BitcoindZeroMQ;

describe('socket.channel: status-check', function() {

	var networks = _.keys(BitcoindZeroMQ.prototype.networks);

	var server;
	var port = 3700;
	var status = 200;
	before(function(done) {
		var tmpApp = express();
		server = tmpApp.listen(port, 'localhost', done);
		tmpApp.get('/', function(req, res, next) {
			res.sendStatus(status);
		})
	});

	var client;
	beforeEach(function(done) {
		client = manager.socketClient();
		client.socket.once('open', function() {
			done();
		});
	});

	var service = app.services.bitcoindZeroMQ;
	beforeEach(function() {
		
		_.each(networks, function(network, index) {
			var statusUrl = 'http://127.0.0.1:' + port;
			var instance = new BitcoindZeroMQ({
				network: network,
				statusUrl: statusUrl,
				statusPollInterval: 5,
			});
			service.instances.push(instance);
		});
	});

	before(function() {
		app.config.statusProviding.frequency =  5;
		app.sockets.startProvidingStatus();
	});

	afterEach(function() {
		if (client) {
			client.socket.destroy();
			client = null;
		}
	});

	afterEach(function() {
		_.invoke(service.instances, 'close');
	});

	after(function() {
		server.close();
		server = null;
	});

	it('receive status for all the networks', function(done) {

		var receivedData = {};
		_.each(networks, function(network) {
			var channel = 'status-check?' + querystring.stringify({
				network: network,
			});

			client.socket.on('data', function(data) {
				if (data && data.channel === channel) {
					receivedData[network] = data.data[network];
				}
			});

			client.subscribe(channel, function(error) {
				if (error) return done(error);
			});
		});

		async.each(networks, function(network, nextNetwork) {
			manager.waitFor(
				function() {
					return !!receivedData[network];
				},
				nextNetwork
			);
		}, done);
	});
});